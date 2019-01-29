const BMP3xx = require('bme280-sensor');

// The BMP3xx constructor options are optional.
//
const options = {
  i2cBusNo   : 1, // defaults to 1
  i2cAddress : BMP3xx.BMP3xx_DEFAULT_I2C_ADDRESS() // defaults to 0x77
};

const bme280 = new BMP3xx(options);

// Read BMP3xx sensor data, repeat
//
const readSensorData = () => {
  bme280.readSensorData()
    .then((data) => {
      // temperature_C, pressure_hPa, and humidity are returned by default.
      // I'll also calculate some unit conversions for display purposes.
      //
      data.temperature_F = BMP3xx.convertCelciusToFahrenheit(data.temperature_C);
      data.pressure_inHg = BMP3xx.convertHectopascalToInchesOfMercury(data.pressure_hPa);

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
bme280.init()
  .then(() => {
    console.log('BMP3xx initialization succeeded');
    readSensorData();
  })
  .catch((err) => console.error(`BMP3xx initialization failed: ${err} `));
