const fs = require('fs');
const sizeOf = require('image-size');
const GIFEncoder = require('gifencoder');
const { createCanvas, Image } = require('canvas');

// BIF file standard
// https://sdkdocs.roku.com/display/sdkdoc/Trick+Mode+Support#TrickModeSupport-BIFFileSpecification

function main (bifFile) {
  if (!fs.existsSync(bifFile)) {
    throw 'File does not exist';
  }

  console.log('Loading BIF file...');
  const fdRead = fs.openSync(bifFile); // Open a file descriptor for the BIF file

  const buffer = fs.readFileSync(fdRead); // Read BIF file data

  fs.closeSync(fdRead); // Close file descriptor

  const imageCount = buffer.readInt32LE(12, 4); // Get image count
  const imageInterval = buffer.readInt32LE(16, 4); // Get interval between images

  console.log('Images count: ' + imageCount);
  console.log('Delay between images (milliseconds): ' + imageInterval);

  let curentBit = 64; // First index of non-header data in the BIF file
  let dimensions = null; // Image dimensions
  let encode = null; // Gif Encoder
  let canvas = null; // Canvas for 1 image
  let ctx = null; // Canvas context where images will be written in
  let gifStream = null; // Final GIF buffer
  for (let i = 0; i < imageCount; i++) {
    const bitRangeIn = buffer.readInt32LE(curentBit + 4); // Get start bit of the current image
    const bitRangeOut = buffer.readInt32LE(curentBit + 12) - 1; // Get end bit of the current image
    const bitRangeSize = bitRangeOut - bitRangeIn; // Get bit count related to the current image

    console.log("#" + i + ": ByteStart=" + bitRangeIn + " ByteEnd=" + bitRangeOut + " ByteSize=" + bitRangeSize);

    const currentImageBuffer = buffer.slice(bitRangeIn, bitRangeOut); // Create a new buffer for the current image

    // if any one of output variable is not filled yet
    if (dimensions === null || encoder === null || canvas === null || ctx === null) {
      dimensions = sizeOf(currentImageBuffer); // Get dimensions of the current image

      encoder = new GIFEncoder(dimensions.width, dimensions.height); // Create a git encoder
      gifStream = encoder.createReadStream(); // Create a stream to pipe image into.
      encoder.start(); // Start the encoder to "listen"
      encoder.setRepeat(0);   // 0 for repeat, -1 for no-repeat
      encoder.setDelay(imageInterval);  // frame delay in ms
      encoder.setQuality(10); // image quality. 10 is default.

      canvas = createCanvas(dimensions.width, dimensions.height); // Create a "global" canvas
      ctx = canvas.getContext('2d'); // Get context of the canvas
    }

    const img = new Image();
    img.src = currentImageBuffer; // Insert current image data (buffer) into Image object

    ctx.drawImage(img, 0, 0); // Draw current image to the context
    // It is not needed to empty the context after writing image in the context
    // Because all image will have the same size

    encoder.addFrame(ctx); // Add current ctx to the GIF encoder

    curentBit += 8; // Forward in the buffer to be at the next image info
  }

  if (encoder) {
    encoder.finish(); // Close the encoder
  }

  gifStream.pipe(fs.createWriteStream('./animated.gif')); // Render the gif image
}

main(process.argv[2])
