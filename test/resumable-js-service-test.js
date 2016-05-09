/* eslint no-unused-vars:0, no-unused-expressions:0 */
import chai, { expect } from 'chai';
import sinon from 'sinon';

import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';

chai.use(chaiAsPromised);
chai.use(sinonChai);

import ResumableJsService from '../src/resumable-js-service';

describe('ResumableJsService', () => {

    afterEach(() => {
        ResumableJsService.__ResetDependency__('fs');
        ResumableJsService.__ResetDependency__('createReadStream');
    });

    var getValidRequest = (method) => {
        var resumableParams = {
            resumableChunkNumber: 1,
            resumableChunkSize: 1000,
            resumableTotalSize: 10500,
            resumableIdentifier: 'identifier',
            resumableFilename: 'some-file'
        };
        var request = {};
        if (method === 'GET') {
            request.query = resumableParams;
        } else {
            request.payload = resumableParams;
            request.payload.file = {
                bytes: 1000,
                path: '/tmp/some-path'
            };
        }
        return request;
    };

    describe('get', () => {
        it('rejects promise if request is invalid', () => {
            var service = new ResumableJsService();
            var request = {};

            var promise = service.get(request);

            return expect(promise).to.be.rejected;
        });

        it('uses chunkPrefix set with setChunkPrefix in chunk filename', () => {
            ResumableJsService.__Rewire__('fs', {
                exists: () => new Promise(resolve => resolve(true)),
            });
            var service = new ResumableJsService();
            var request = getValidRequest('GET');

            service.setChunkPrefix('chunk-prefix');
            var promise = service.get(request);

            return expect(promise).to.be.fulfilled.then(result => {
                expect(result.chunkFilename).to.match(/\/chunk-prefix/);
            });
        });

        it('uses chunkPrefix set in constructor in chunk filename', () => {
            ResumableJsService.__Rewire__('fs', {
                exists: () => new Promise(resolve => resolve(true)),
            });
            var service = new ResumableJsService({ chunkPrefix: 'chunk-prefix' });
            var request = getValidRequest('GET');

            var promise = service.get(request);

            return expect(promise).to.be.fulfilled.then(result => {
                expect(result.chunkFilename).to.match(/\/chunk-prefix/);
            });
        });

        it('rejects if chunkNumber is < 1', () => {
            var service = new ResumableJsService();
            var request = getValidRequest('GET');

            request.query.resumableChunkNumber = 0;
            var promise = service.get(request);

            return expect(promise).to.be.rejected.then(error => {
                expect(error).to.equal('Not a valid resumable request');
            });
        });

        it('rejects if chunkSize is < 1', () => {
            var service = new ResumableJsService();
            var request = getValidRequest('GET');

            request.query.resumableChunkSize = 0;
            var promise = service.get(request);

            return expect(promise).to.be.rejected.then(error => {
                expect(error).to.equal('Not a valid resumable request');
            });
        });

        it('rejects if totalSize is < 1', () => {
            var service = new ResumableJsService();
            var request = getValidRequest('GET');

            request.query.resumableTotalSize = 0;
            var promise = service.get(request);

            return expect(promise).to.be.rejected.then(error => {
                expect(error).to.equal('Not a valid resumable request');
            });
        });

        it('rejects if chunkNumber exceeds expected number of chunks', () => {
            var service = new ResumableJsService();
            var request = getValidRequest('GET');

            request.query.resumableChunkNumber = 100;
            var promise = service.get(request);

            return expect(promise).to.be.rejected.then(error => {
                expect(error).to.equal('Invalid chunk number');
            });
        });

        it('resolves to false if chunk does not exist', () => {
            ResumableJsService.__Rewire__('fs', {
                exists: () => new Promise(resolve => resolve(false)),
            });
            var service = new ResumableJsService();

            var promise = service.get(getValidRequest('GET'));

            return expect(promise).to.be.fulfilled.then(result => {
                expect(result).to.equal(false);
            });
        });

        it('resolves with chunk info if chunk exists', () => {
            ResumableJsService.__Rewire__('fs', {
                exists: () => new Promise(resolve => resolve(true)),
            });
            var service = new ResumableJsService();
            var request = getValidRequest('GET');

            var promise = service.get(request);

            return expect(promise).to.be.fulfilled.then(result => {
                expect(result.chunkFilename).to.be.ok;
                expect(result.filename).to.equal(request.query.resumableFilename);
                expect(result.identifier).to.equal(request.query.resumableIdentifier);
            });
        });

        it('rejects with error if fs.exists fails', () => {
            ResumableJsService.__Rewire__('fs', {
                exists: () => new Promise((resolve, reject) => reject('error!')),
            });
            var service = new ResumableJsService();
            var request = getValidRequest('GET');

            var promise = service.get(request);

            return expect(promise).to.be.rejected.then(error => {
                expect(error).to.equal('error!');
            });
        });
    });

    describe('post', () => {
        it('rejects if not last chunk and file size is unequal to chunkSize', () => {
            var service = new ResumableJsService();
            var request = getValidRequest('POST');

            request.payload.file.bytes = 50;
            var promise = service.post(request);

            return expect(promise).to.be.rejected.then(error => {
                expect(error).to.equal(`The chunk in the POST request isn't the correct size`);
            });
        });

        it('rejects if file fits in a single chunk and file size is unequal to total size', () => {
            var service = new ResumableJsService();
            var request = getValidRequest('POST');

            request.payload.resumableTotalSize = 1000;
            request.payload.file.bytes = 999;
            var promise = service.post(request);

            return expect(promise).to.be.rejected.then(error => {
                expect(error).to.equal(`The file is only a single chunk, and the data size does not fit`);
            });
        });

        it('rejects if file missing from payload', () => {
            var service = new ResumableJsService();
            var request = getValidRequest('POST');

            delete request.payload.file;
            var promise = service.post(request);

            return expect(promise).to.be.rejected.then(error => {
                expect(error).to.equal('File missing');
            });
        });

        it('rejects if file has no bytes', () => {
            var service = new ResumableJsService();
            var request = getValidRequest('POST');

            request.payload.file.bytes = 0;
            var promise = service.post(request);

            return expect(promise).to.be.rejected.then(error => {
                expect(error).to.equal('File missing');
            });
        });

        it('renames file and returns { complete: false } if not last chunk', () => {
            ResumableJsService.__Rewire__('fs', {
                rename: () => new Promise(resolve => resolve()),
                exists: () => new Promise(resolve => resolve(false)),
            });
            var service = new ResumableJsService();
            var request = getValidRequest('POST');

            var promise = service.post(request);

            return expect(promise).to.be.fulfilled.then(result => {
                expect(result.complete).to.equal(false);
            });
        });

        it('renames file and returns { complete: true } and identifier if last chunk', () => {
            ResumableJsService.__Rewire__('fs', {
                rename: () => new Promise(resolve => resolve()),
                exists: () => new Promise(resolve => resolve(true)),
            });
            var service = new ResumableJsService();
            var request = getValidRequest('POST');

            var promise = service.post(request);

            return expect(promise).to.be.fulfilled.then(result => {
                expect(result.complete).to.equal(true);
                expect(result.identifier).to.equal(service._cleanIdentifier(request.payload.resumableIdentifier));
            });
        });

        it('uses chunkPrefix set with setChunkPrefix in chunk filename', () => {
            var mockFs = {
                rename: () => new Promise(resolve => resolve()),
                exists: () => new Promise(resolve => resolve(true)),
            };
            sinon.spy(mockFs, 'rename');
            ResumableJsService.__Rewire__('fs', mockFs);
            var service = new ResumableJsService();
            var request = getValidRequest('POST');

            service.setChunkPrefix('chunk-prefix');
            var promise = service.post(request);

            return expect(promise).to.be.fulfilled.then(result => {
                expect(mockFs.rename.args[0][1]).to.match(/\/chunk-prefix/);
            });
        });

        it('uses chunkPrefix set in constructor in chunk filename', () => {
            var mockFs = {
                rename: () => new Promise(resolve => resolve()),
                exists: () => new Promise(resolve => resolve(true)),
            };
            sinon.spy(mockFs, 'rename');
            ResumableJsService.__Rewire__('fs', mockFs);
            var service = new ResumableJsService({ chunkPrefix: 'chunk-prefix' });
            var request = getValidRequest('POST');

            var promise = service.post(request);

            return expect(promise).to.be.fulfilled.then(result => {
                expect(mockFs.rename.args[0][1]).to.match(/\/chunk-prefix/);
            });
        });

        it('rejects if rename fails', () => {
            var mockFs = {
                rename: () => new Promise((resolve, reject) => reject('error!')),
                exists: () => new Promise(resolve => resolve(true)),
            };
            ResumableJsService.__Rewire__('fs', mockFs);
            var service = new ResumableJsService();
            var request = getValidRequest('POST');

            var promise = service.post(request);

            return expect(promise).to.be.rejected.then(error => {
                expect(error).to.equal('error!');
            });
        });

        it('rejects if fs.exists fails', () => {
            var mockFs = {
                rename: () => new Promise(resolve => resolve()),
                exists: () => new Promise((resolve, reject) => reject('error!')),
            };
            ResumableJsService.__Rewire__('fs', mockFs);
            var service = new ResumableJsService();
            var request = getValidRequest('POST');

            var promise = service.post(request);

            return expect(promise).to.be.rejected.then(error => {
                expect(error).to.equal('error!');
            });
        });
    });

    describe('write', () => {

        var mockWritableStream;
        var readStreams;

        beforeEach(() => {
            readStreams = [];
            ResumableJsService.__Rewire__('createReadStream', () => {
                var stream = {
                    pipe: sinon.spy(),
                    on: (event, func) => {
                        func();
                    },
                };
                readStreams.push(stream);
                return stream;
            });
            mockWritableStream = {
                on: sinon.spy(),
                end: sinon.spy(),
            };
        });

        it('rejects on writable stream error', () => {
            var service = new ResumableJsService();

            var promise = service.write('identifier', mockWritableStream);

            expect(mockWritableStream.on).to.have.been.called;
            expect(mockWritableStream.on.args[0][0]).to.equal('error');
            mockWritableStream.on.args[0][1]('error!');

            return expect(promise).to.be.rejected.then(error => {
                expect(error).to.equal('error!');
            });
        });

        it('pipes each chunk into the writeable stream until it runs out of chunks', () => {
            var service = new ResumableJsService();

            ResumableJsService.__Rewire__('fs', {
                exists: (filename) => new Promise((resolve, reject) => {
                    // 11th chunk not found
                    resolve(filename.match(/11$/) === null);
                })
            });

            var promise = service.write('identifier', mockWritableStream);

            return expect(promise).to.be.fulfilled.then(() => {
                expect(readStreams.length).to.equal(10);
                readStreams.forEach(stream =>
                    expect(stream.pipe).to.have.been.calledWith(
                        mockWritableStream,
                        { end: false }
                    )
                );
            });
        });

        it('ends writable stream', () => {
            var service = new ResumableJsService();

            ResumableJsService.__Rewire__('fs', {
                exists: (filename) => new Promise((resolve, reject) => {
                    // 11th chunk not found
                    resolve(filename.match(/11$/) === null);
                })
            });

            var promise = service.write('identifier', mockWritableStream);

            return expect(promise).to.be.fulfilled.then(() => {
                expect(mockWritableStream.end).to.have.been.called;
            });
        });

        it('does not end writable stream if { end: false } option passed', () => {
            var service = new ResumableJsService();

            ResumableJsService.__Rewire__('fs', {
                exists: (filename) => new Promise(resolve => {
                    // 11th chunk not found
                    resolve(filename.match(/11$/) === null);
                })
            });

            var promise = service.write('identifier', mockWritableStream, { end: false });

            return expect(promise).to.be.fulfilled.then(() => {
                expect(mockWritableStream.end).to.not.have.been.called;
            });
        });

        it('rejects if fs.exists fails', () => {
            var service = new ResumableJsService();

            ResumableJsService.__Rewire__('fs', {
                exists: (filename) => new Promise((resolve, reject) => reject('error!'))
            });

            var promise = service.write('identifier', mockWritableStream);

            return expect(promise).to.be.rejected.then(error => {
                expect(error).to.equal('error!');
            });
        });
    });

    describe('clean', () => {

        var mockWritableStream;

        beforeEach(() => {
            mockWritableStream = {
                on: sinon.spy(),
                end: sinon.spy(),
            };
        });

        it('deletes all found chunks', () => {
            var service = new ResumableJsService();
            var deleted = [];

            ResumableJsService.__Rewire__('fs', {
                exists: (filename) => new Promise(resolve => {
                    // 11th chunk not found
                    resolve(filename.match(/11$/) === null);
                }),
                remove: (filename) => new Promise(resolve => {
                    deleted.push(filename);
                    resolve();
                }),
            });

            var promise = service.clean('identifier', mockWritableStream);

            return expect(promise).to.be.fulfilled.then(() => {
                expect(deleted.length).to.equal(10);
            });
        });

        it('rejects if fs.exists fails', () => {
            var service = new ResumableJsService();
            var deleted = [];

            ResumableJsService.__Rewire__('fs', {
                exists: (filename) => new Promise((resolve, reject) => reject('error!')),
            });

            var promise = service.clean('identifier', mockWritableStream);

            return expect(promise).to.be.rejected.then(error => {
                expect(error).to.equal('error!');
            });
        });

        it('rejects if fs.remove fails', () => {
            var service = new ResumableJsService();
            var deleted = [];

            ResumableJsService.__Rewire__('fs', {
                exists: (filename) => new Promise(resolve => {
                    // 11th chunk not found
                    resolve(filename.match(/11$/) === null);
                }),
                remove: (filename) => new Promise((resolve, reject) => reject('error!')),
            });

            var promise = service.clean('identifier', mockWritableStream);

            return expect(promise).to.be.rejected.then(error => {
                expect(error).to.equal('error!');
            });
        });
    });
});
