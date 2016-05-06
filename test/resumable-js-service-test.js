/* eslint no-unused-vars:0, no-unused-expressions:0 */
import chai, { expect } from 'chai';
import sinon from 'sinon';

import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';

chai.use(chaiAsPromised);
chai.use(sinonChai);

import ResumableJsService from '../src/resumable-js-service';

describe('ResumableJsService', () => {

    var getValidRequest = (method) => {
        var resumableParams = {
            resumableChunkNumber: 1,
            resumableChunkSize: 1000,
            resumableTotalSize: 10000,
            resumableIdentifier: 'identifier',
            resumableFilename: 'some-file'
        };
        var request = {};
        if (method === 'GET') {
            request.query = resumableParams;
        } else {
            request.payload = resumableParams;
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

        it('resolves to false if chunk does not exist', () => {
            ResumableJsService.__Rewire__('fs', {
                exists: () => new Promise(resolve => resolve(false)),
            });
            var service = new ResumableJsService();

            var promise = service.get(getValidRequest('GET'));

            return expect(promise).to.be.fulfilled.then(resolution => {
                expect(resolution).to.equal(false);
            });
        });

        it('resolves with chunk info if chunk exists', () => {
            ResumableJsService.__Rewire__('fs', {
                exists: () => new Promise(resolve => resolve(true)),
            });
            var service = new ResumableJsService();
            var request = getValidRequest('GET');

            var promise = service.get(request);

            return expect(promise).to.be.fulfilled.then(resolution => {
                expect(resolution.chunkFilename).to.be.ok;
                expect(resolution.filename).to.equal(request.query.resumableFilename);
                expect(resolution.identifier).to.equal(request.query.resumableIdentifier);
            });
        });
    });
});
