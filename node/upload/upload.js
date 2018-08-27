'use strict';

/**
 * 
 * MediaSilo
 *
 * Created By: Mike Delano
 * Created On: 06/10/2014
 *
 *
 * Example usage: node upload <HOSTNAME> <USERNAME> <PASSWORD> <PROJECT ID> <FILE PATH>
 **/



var url       = require('url');
var http      = require('https');
var fs        = require('fs');
var path      = require('path');
var Q         = require('q');


var args = process.argv.slice(2);

/**
 * MEDIASILO_API_URL The API URL can be changed 
 * to use any of our API versions. The URL below 
 * is the latest version.
 * @type {String}
 */
var MEDIASILO_API_URL       = 'https://p-api-new.mediasilo.com/v3/';

/**
 * mediaSiloHostname This is the subdomain that 
 * you log into mediasilo with. For example, 
 * YOURCOMPANY.mediasilo.com, would use YOURCOMPANY 
 * as the hostname here.
 * @type {String}
 */
var mediaSiloHostname  = args[0];

/**
 * mediaSiloUsername The user which will be used 
 * to access the MediaSilo API. The user should have the 
 * Asset.Create permission.
 * @type {String}
 */
var mediaSiloUsername  = args[1];

/**
 * mediaSiloPassword The users password
 * @type {String}
 */
var mediaSiloPassword  = args[2];

/**
 * mediaSiloProjectId The project to which the file will be uploaded
 * 
 * See http://docs.mediasilo.com/v3.0/docs/get-all-projects
 * for documentation on getting projects
 * 
 * @type {String}
 */
var mediaSiloProjectId = args[3];



/**
 * getMediaSiloRequestOptions Gets HTTP request options for making requests to the MediaSilo REST API
 * @method getMediaSiloRequestOptions
 * @param  {[type]}                   resourcePath [description]
 * @param  {[type]}                   httpMethod   [description]
 * @return {[type]}                                [description]
 */
function getMediaSiloRequestOptions(resourcePath, httpMethod) {
  var parsedUrl = url.parse(MEDIASILO_API_URL + resourcePath);
  
  return {
    host: parsedUrl.hostname,
    path: parsedUrl.path,
    method: httpMethod,
    auth: mediaSiloUsername + ':' + mediaSiloPassword,
    headers: {
      'MediaSiloHostContext'    : mediaSiloHostname,
    }
  };  
}



/**
 * getUploadTicket Uses the MediaSilo API to 
 * get an upload ticket that will provide the 
 * details needed to upload our local file
 *
 * See http://docs.mediasilo.com/v3.0/docs/create-upload-ticket 
 * for documentation
 * 
 * @method getUploadTicket
 * @param  {String}        filePath The full path to the file to be uploaded
 * @return {UploadTicket}  
 *         {  assetUrl: 'https://s3.amazonaws.com/ingest-east.mediasilo.com/6cdb4514-f3d4-44fe-b07e-0fd9a27be059/MYFILE.mov',
              amzDate: 'Wed, 10 Jun 2015 18:01:46 GMT',
              amzAcl: 'private',
              contentType: 'application/octet-stream',
              authorization: 'AWS AKIAIBTQICBLRC7JU6RA:ho9vfMMYadN0PNY72Gd74nFMCcg=',
              httpMethod: 'PUT' 
            } 

 */
function getUploadTicket(filePath) {
  var deferred = Q.defer();
  
  var fileName = path.basename(filePath);
  var options = getMediaSiloRequestOptions('assets/upload', 'POST');

  var request = http.request(options, function(response) {
      if (response.statusCode < 399) {
          var json = '';
          response.on('data', function(chunk) {
            json += chunk;
          });
          response.on('end', function(data) {
              deferred.resolve({
                filePath: filePath,
                uploadTicket: JSON.parse(json)
              });
          });
          response.on('error', function(e) {
              deferred.reject(e);
          });
      } else {
        deferred.reject(new Error('Could not upload file. Recieved ' + response.statusCode + ' from remote server'));
      }
  });
  
  request.write(JSON.stringify({ fileName: fileName }));
  request.end();

  return deferred.promise;   
}




/**
 * uploadFile Uploads a file using a MediaSilo upload ticket
 * @method uploadFile
 * @param  {[type]}   uploadOptions 
 *         { 
 *         		filePath: '/Users/mmmmm/Downloads/IMG_3877.CR2',
              uploadTicket: { 
                assetUrl: 'https://s3.amazonaws.com/ingest-east.mediasilo.com/6cdb4514-f3d4-44fe-b07e-0fd9a27be059/IMG_3877.CR2',
                amzDate: 'Wed, 10 Jun 2015 18:01:46 GMT',
                amzAcl: 'private',
                contentType: 'application/octet-stream',
                authorization: 'AWS AKIAIBTQICBLRC7JU6RA:ho9vfMMYadN0PNY72Gd74nFMCcg=',
                httpMethod: 'PUT' 
              } 
            }
 */
function uploadFile(uploadOptions) {
  var deferred = Q.defer();
  
  var stats = fs.statSync(uploadOptions.filePath);
  var fileSizeInBytes = stats.size;
  var parsedUrl = url.parse(uploadOptions.uploadTicket.assetUrl);
  
  var options = {
    host: parsedUrl.hostname,
    path: parsedUrl.path,
    method: uploadOptions.uploadTicket.httpMethod,
    headers: {
      'x-amz-date'    : uploadOptions.uploadTicket.amzDate,
      'Authorization' : uploadOptions.uploadTicket.authorization,
      'x-amz-acl'     : uploadOptions.uploadTicket.amzAcl,
      'Content-Type'  : uploadOptions.uploadTicket.contentType,
      'Content-Length': fileSizeInBytes
    }
  };

  var request = http.request(options, function(response) {
      if (response.statusCode < 399) {
          var text = '';
          response.on('data', function(chunk) {
              text += chunk;
          });
          response.on('end', function(data) {
              deferred.resolve(uploadOptions);
          });
          response.on('error', function(e) {
              deferred.reject(e);
          });
      } else {
        deferred.reject(new Error('Could not upload file. Recieved ' + response.statusCode + ' from remote server'));
      }
  });
  
  console.log('Uploading', uploadOptions.filePath, 'to MediaSilo S3 ingest bucket');
  
  request.write(fs.readFileSync(uploadOptions.filePath));
  request.end();

  return deferred.promise;  
}




/**
 * createAsset Creates an asset in MediaSilo from a given URL
 * 
 * See http://docs.mediasilo.com/v3.0/docs/create-asset for 
 * full documentation on asset creation
 * 
 * @method createAsset
 * @param  {[type]}    assetUrl A publicly accesible URL 
 * OR a URL to MediaSilo's S3 ingest bucket
 */
function createAsset(assetUrl) {
  var deferred = Q.defer();
  
  var options = getMediaSiloRequestOptions('assets', 'POST');

  var request = http.request(options, function(response) {
      if (response.statusCode < 399) {
          var json = '';
          response.on('data', function(chunk) {
            json += chunk;
          });
          response.on('end', function(data) {
              deferred.resolve(JSON.parse(json));
          });
          response.on('error', function(e) {
              deferred.reject(e);
          });
      } else {
        deferred.reject(new Error('Recieved ' + response.statusCode + ' from remote server'));
      }
  });
  
  request.write(JSON.stringify({ projectId: mediaSiloProjectId, sourceUrl: assetUrl }));
  request.end();

  return deferred.promise;   
}

getUploadTicket(args[4]).then(uploadFile).then(function(uploadFileResult) {
      return createAsset(uploadFileResult.uploadTicket.assetUrl).then(function(r) {
        console.log('Created asset', uploadFileResult);
      });
}).fail(function(e) {
    console.log(e, e.stack); 
});
