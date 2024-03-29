const fs = require('fs');
const sizeOf = require('image-size');
const GIFEncoder = require('gifencoder');
const { createCanvas, Image } = require('canvas');

// BIF file standard
// https://sdkdocs.roku.com/display/sdkdoc/Trick+Mode+Support#TrickModeSupport-BIFFileSpecification

const BIF_VERSION_COMPATIBILITY = 0;

function main (bifFile) {
  if (!fs.existsSync(bifFile)) {
    throw 'File does not exist';
  }

  console.log('Loading BIF file...');
  const fdRead = fs.openSync(bifFile); // Open a file descriptor for the BIF file

  const buffer = fs.readFileSync(fdRead); // Read BIF file data

  fs.closeSync(fdRead); // Close file descriptor

  const bifVersion = buffer.readUInt32LE(8, 4); // Get bif version
  // Current supported version of this script is 0

  if (bifVersion != BIF_VERSION_COMPATIBILITY) {
    console.log('WARNING: This script was made to work with version 0 of BIF file');
    console.log('         The version of this BIF file is ' + bifVersion);
  }

  const imageCount = buffer.readUInt32LE(12, 4); // Get image count
  const timestampMultiplier = buffer.readInt32LE(16, 4); // Get timestamp multiplier

  console.log('Images count: ' + imageCount);

  let curentByte = 64; // First index of non-header data in the BIF file
  let dimensions = null; // Image dimensions
  let encode = null; // Gif Encoder
  let canvas = null; // Canvas for 1 image
  let ctx = null; // Canvas context where images will be written in
  let gifStream = null; // Final GIF buffer
  let imageDelay = 10;
  for (let i = 0; i < imageCount; i++) {
    // Last image of the BIF file has a crazy timestamp (0xffffffff)
    if (i < imageCount - 1) {
      const byteCurrentImageTimestamp = buffer.readUInt32LE(curentByte); // Get start timestamp of the current image
      const byteNextImageTimestamp = buffer.readUInt32LE(curentByte + 8); // Get start timestamp of the next image

      imageDelay = (byteNextImageTimestamp - byteCurrentImageTimestamp) * timestampMultiplier;
    }

    const byteCurrentImageIn = buffer.readUInt32LE(curentByte + 4); // Get start byte of the current image
    const byteNextImageIn = buffer.readUInt32LE(curentByte + 12); // Get end byte of the current image

    console.log("#" + i + ": ByteStart=" + byteCurrentImageIn + " ByteEnd=" + byteNextImageIn + " Delay(ms)=" + imageDelay);

    const currentImageBuffer = buffer.slice(byteCurrentImageIn, byteNextImageIn); // Create a new buffer for the current image
    // Because second parameter of the slice function is not inclusive, we give the first byte of the next image

    // if any one of output variable is not filled yet
    if (dimensions === null || encoder === null || canvas === null || ctx === null) {
      dimensions = sizeOf(currentImageBuffer); // Get dimensions of the current image

      encoder = new GIFEncoder(dimensions.width, dimensions.height); // Create a git encoder
      gifStream = encoder.createReadStream(); // Create a stream to pipe image into.
      encoder.start(); // Start the encoder to "listen"
      encoder.setRepeat(0);   // 0 for repeat, -1 for no-repeat
      encoder.setQuality(10); // image quality. 10 is default.

      canvas = createCanvas(dimensions.width, dimensions.height); // Create a "global" canvas
      ctx = canvas.getContext('2d'); // Get context of the canvas
    }

    const img = new Image();
    img.src = currentImageBuffer; // Insert current image data (buffer) into Image object

    ctx.drawImage(img, 0, 0); // Draw current image to the context
    // It is not needed to empty the context after writing image in the context
    // Because all image will have the same size

    encoder.setDelay(imageDelay);  // frame delay in ms
    encoder.addFrame(ctx); // Add current ctx to the GIF encoder

    curentByte += 8; // Forward in the buffer to be at the next image info
  }

  if (encoder) {
    encoder.finish(); // Close the encoder
  }

  gifStream.pipe(fs.createWriteStream('./animated.gif')); // Render the gif image
}

main(process.argv[2])
