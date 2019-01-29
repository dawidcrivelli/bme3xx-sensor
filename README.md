# bmp3xx-sensor
[<img src="https://img.shields.io/badge/Node.js-4.x%20through%207.x-brightgreen.svg">](https://nodejs.org) [<img src="https://img.shields.io/npm/v/bme280-sensor.svg">](https://www.npmjs.com/package/bme280-sensor) [![bitHound Overall Score](https://www.bithound.io/github/skylarstein/bme280-sensor/badges/score.svg)](https://www.bithound.io/github/skylarstein/bme280-sensor)


[<img src="https://cdn-learn.adafruit.com/assets/assets/000/026/680/medium800/sensors_pinout.jpg" width="150" align="right">](https://www.adafruit.com/product/2652)

Welcome to bme3xx-sensor, a Node.js I2C module for the Bosch BMP3xx family of Humidity, Barometric Pressure, Temperature Sensor. Adafruit sells a [BMP388 breakout board](https://www.adafruit.com/product/3966) and [here is the datasheet](https://ae-bst.resource.bosch.com/media/_tech/media/datasheets/BST-BMP388-DS001.pdf).

This module uses [i2c-bus](https://github.com/fivdi/i2c-bus) which should provide access with Node.js on Linux boards like the Raspberry Pi Zero, 1, 2, or 3, BeagleBone, BeagleBone Black, or Intel Edison.

Note: While the BMP3xx/BMP280 device does report temperature, it is measured by the internal temperature sensor. This temperature value depends on the PCB temperature and sensor element self-heating. Therefore ambient temperature is typically reported above actual ambient temperature.

Since bme280-sensor needs to talk directly to the I2C bus and requires access to /dev/i2c, you will typically need run Node with elevated privileges or add your user account to the i2c group: ```$ sudo adduser $USER i2c```

## Example Code

```
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
```

##Example Output

```
> sudo node example.js
Found BMP3xx chip id 0x60 on bus i2c-1 address 0x77
BMP3xx initialization succeeded
data = {
  "temperature_C": 32.09,
  "humidity": 34.851083883116694,
  "pressure_hPa": 1010.918480644477,
  "temperature_F": 89.76200000000001,
  "pressure_inHg": 29.852410107059583
}
```
##Example Wiring

For I2C setup on a Raspberry Pi, take a look at my [pi-weather-station](https://github.com/skylarstein/pi-weather-station) project.
