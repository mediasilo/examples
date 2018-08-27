#### This is meant for example purposes and should not be used in production as is.

#### Installation
```
git clone https://github.com/mediasilo/examples.git
cd node/upload
npm install
```

#### Usage

```node upload <HOSTNAME> <USERNAME> <PASSWORD> <PROJECT ID> <FILE PATH>```

#### Notes

* This example implements MediaSilo API endpoints which are documented fully [here](http://docs.mediasilo.com/v3.0/docs).

* This example doesn't upload using a stream. Therefore, memory on the local system should be considered for large files.
