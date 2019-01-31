const BMP3xx = require('../BMP3xx');

// The BMP3xx constructor options are optional.
//
const options = {
  i2cBusNo   : 1, // defaults to 1
  i2cAddress : BMP3xx.BMP3xx_DEFAULT_I2C_ADDRESS()
};

const bmp388 = new BMP3xx(options);

// Read BMP3xx sensor data, repeat
//
const readSensorData = () => {
  bmp388.readSensorData()
    .then((data) => {
      // temperature_C, pressure_hPa, and humidity are returned by default.
      // I'll also calculate some unit conversions for display purposes.

      data.altitude_m = BMP3xx.calculateAltitudeMeters(data.pressure_hPa, 998.0)

      console.log(`data = ${JSON.stringify(data, null, 2)}`);
      setTimeout(readSensorData, 2000);
    })
    .catch((err) => {
      console.log(`BMP3xx read error: ${err}`);
      setTimeout(readSensorData, 2000);
    });
};

// Initialize the BMP3xx sensor
//
bmp388.init()
  .then(() => {
    console.log('BMP3xx initialization succeeded');
    readSensorData();
  })
  .catch((err) => console.error(`BMP3xx initialization failed: ${err} `));
