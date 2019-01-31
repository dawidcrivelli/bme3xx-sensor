/*
  BMP3xx.js

  A Node.js I2C module for the Bosch BMP3xx Humidity, Barometric Pressure, and Temperature Sensor.

  Support is also included for the Bosch BMP280 Barometric Pressure and Temperature Sensor.
*/

'use strict';

class BMP3xx {

  constructor(options) {
    const i2c = require('i2c-bus');
    this.seaLevelPressure = 1013.25
    this.cal = null

    this.i2cBusNo = (options && options.hasOwnProperty('i2cBusNo')) ? options.i2cBusNo : 1;
    this.i2cBus = i2c.openSync(this.i2cBusNo);
    this.i2cAddress = (options && options.hasOwnProperty('i2cAddress')) ? options.i2cAddress : BMP3xx.BMP3xx_DEFAULT_I2C_ADDRESS();

    this.REGISTER_CHIPID        = 0x00;
    this.REGISTER_STATUS        = 0x03;
    this.REGISTER_PRESSURE_DATA = 0x04;
    this.REGISTER_TEMP_DATA     = 0x07;
    this.REGISTER_HUMIDITY_DATA = 0x09;
    this.REGISTER_CONTROL       = 0x1B;
    this.REGISTER_OSR           = 0x1C;
    this.REGISTER_ODR           = 0x1D;
    this.REGISTER_CONFIG        = 0x1F;
    this.REGISTER_CAL_DATA      = 0x31;
    this.REGISTER_CMD           = 0x7E;

    this.OSR_SETTINGS = [1, 2, 4, 8, 16, 32]          // pressure and temperature oversampling settings
    this.IIR_SETTINGS = [0, 2, 4, 8, 16, 32, 64, 128] // IIR filter coefficients

    this.defaultOsrSetting = 0b001100  // temperature x2 oversampling, pressure x16 oversampling, recommended per table 5 on page 13
    // no IIR filter
  }

  readChipId() {
    return new Promise((resolve, reject) => {
      this.i2cBus.writeByte(this.i2cAddress, this.REGISTER_CHIPID, 0, (err) => {
        if (err) {
          return reject(err);
        }
        this.i2cBus.readByte(this.i2cAddress, this.REGISTER_CHIPID, (err, chipId) => {
          if (err) {
            return reject(err);
          } else if (chipId !== BMP3xx.CHIP_ID_BMP3xx()) {
            return reject(`Unexpected BMx3xx chip ID: 0x${chipId.toString(16)}`)
          } else {
            console.log(`Found BMx3xx chip ID 0x${chipId.toString(16)} on bus i2c-${this.i2cBusNo}, address 0x${this.i2cAddress.toString(16)}`);
            return resolve(chipId);
          }
        })
      })
    })
  }

  init() {
    return this.readChipId().
      then(() => new Promise((resolve, reject) => {
        this.loadCalibration((err) => {
          if (err) {
            return reject(err);
          }
          // Temperture/pressure 16x oversampling, normal mode
          //
          this.i2cBus.writeByte(this.i2cAddress, this.REGISTER_CONTROL, this.defaultOsrSetting, (err) => {
            return err ? reject(err) : resolve();
          });
        })
    }))
  }

  // reset()
  //
  // Perform a power-on reset procedure. You will need to call init() following a reset()
  //
  reset() {
    return new Promise((resolve, reject) => {
      const POWER_ON_RESET_CMD = 0xB6;
      this.i2cBus.writeByte(this.i2cAddress, this.REGISTER_CMD, POWER_ON_RESET_CMD, (err) => {
        return err ? reject(err) : resolve();
      });
    });
  }

  initiateReadOut() {
    return new Promise((resolve, reject) => {
      this.i2cBus.writeByte(this.i2cAddress, this.REGISTER_CONTROL, 0x13, (err) => {
        if (err) return reject(err)
        setTimeout(resolve, 50)
      })
    })
  }

  readSensorData() {
    return this.initiateReadOut().then(() => this.getData())
  }

  testInit() {
    return new Promise((resolve, reject) => {
      if (this.cal) resolve()
      else this.init().then(() => resolve())
    })
  }

  async getData() {
    await this.testInit()

    return new Promise((resolve, reject) => {
      // Grab temperature, humidity, and pressure in a single read
      //
      this.i2cBus.readI2cBlock(this.i2cAddress, this.REGISTER_PRESSURE_DATA, 6, new Buffer(6), (err, bytesRead, buffer) => {
        if (err) {
          reject(err);
        }

        // Temperature (temperature first since we need it for P and H)
        let adc_T = BMP3xx.uint24(buffer[5], buffer[4], buffer[3]);
        // Pressure
        let adc_P = BMP3xx.uint24(buffer[2], buffer[1], buffer[0]);

        // console.debug(`Raw T: ${adc_T}, raw P: ${adc_P}`)
        let td1 = adc_T - this.cal.T1
        let td2 = td1 * this.cal.T2

        let temperature = td2 + (td1 * td1) * this.cal.T3

        let po1 =
          this.cal.P5 +
          this.cal.P6 * temperature +
          this.cal.P7 * temperature ** 2 +
          this.cal.P8 * temperature ** 3

        let po2 = adc_P * (
          this.cal.P1 +
          this.cal.P2 * temperature +
          this.cal.P3 * temperature ** 2 +
          this.cal.P4 * temperature ** 3
        )

        let pd1 = adc_P ** 2
        let pd2 = this.cal.P9 + this.cal.P10 * temperature
        let po3 = pd1 * pd2 + this.cal.P11 * adc_P ** 3

        let pressure_Pa = po1 + po2 + po3

        resolve({
          temperature_C: temperature,
          pressure_hPa: pressure_Pa / 100.0,
        });
      })
    });
  }

  loadCalibration(callback) {
    const bytesToRead = 21

    this.i2cBus.readI2cBlock(this.i2cAddress, this.REGISTER_CAL_DATA, bytesToRead, new Buffer(bytesToRead), (err, bytesRead, buffer) => {
      if (err) callback(err)
      if (bytesRead !== bytesToRead) console.warn(`Read only ${bytesRead} / ${bytesToRead} bytes`)

      let offset = 0
      "HHb"
      let T1 = buffer.readUInt16LE(offset) / 2 ** -8
      offset += 2
      let T2 = buffer.readUInt16LE(offset) / 2 ** 30
      offset += 2
      let T3 = buffer.readInt8(offset) / 2 ** 48
      offset += 1

      " h h b b H H b b h b b "
      let P1 = (buffer.readInt16LE(offset) - 2 ** 14) / 2 ** 20
      offset += 2
      let P2 = (buffer.readInt16LE(offset) - 2 ** 14) / 2 ** 29
      offset += 2
      let P3 = buffer.readInt8(offset) / 2 ** 32
      offset += 1
      let P4 = buffer.readInt8(offset) / 2 ** 37
      offset += 1
      let P5 = buffer.readUInt16LE(offset) / 2 ** -3
      offset += 2
      let P6 = buffer.readUInt16LE(offset) / 2 ** 6
      offset += 2
      let P7 = buffer.readInt8(offset) / 2 ** 8
      offset += 1
      let P8 = buffer.readInt8(offset) / 2 ** 15
      offset += 1
      let P9 = buffer.readInt16LE(offset) / 2 ** 48
      offset += 2
      let P10 = buffer.readInt8(offset) / 2 ** 48
      offset += 1
      let P11 = buffer.readInt8(offset) / 2 ** 65
      offset += 1

      this.cal = { T1, T2, T3, P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11}

      // console.debug('BMP3xx cal = ' + JSON.stringify(this.cal, null, 2));
      callback();
    });
  }

  static BMP3xx_DEFAULT_I2C_ADDRESS() {
    return 0x76;
  }

  static CHIP_ID_BMP3xx() {
    return 0x50;
  }

  static uint24(msb, lsb, xlsb) {
    return msb << 16 | lsb << 8 | xlsb;
  }

  static convertCelciusToFahrenheit(c) {
    return c * 9 / 5 + 32;
  }

  static convertHectopascalToInchesOfMercury(hPa) {
    return hPa * 0.02952998751;
  }

  static convertMetersToFeet(m) {
    return m * 3.28084;
  }

  static calculateHeatIndexCelcius(temperature_C, humidity) {
    return -8.784695 + 1.61139411 * temperature_C + 2.33854900 * humidity +
           -0.14611605 * temperature_C * humidity + -0.01230809 * Math.pow(temperature_C, 2) +
           -0.01642482 * Math.pow(humidity, 2) + 0.00221173 * Math.pow(temperature_C, 2) * humidity +
           0.00072546 * temperature_C * Math.pow(humidity, 2) +
           -0.00000358 * Math.pow(temperature_C, 2) * Math.pow(humidity, 2);
  }

  static calculateDewPointCelcius(temperature_C, humidity) {
    return 243.04 * (Math.log(humidity/100.0) + ((17.625 * temperature_C)/(243.04 + temperature_C))) /
           (17.625 - Math.log(humidity/100.0) - ((17.625 * temperature_C)/(243.04 + temperature_C)));
  }

  static calculateAltitudeMeters(pressure_hPa, seaLevelPressure_hPa) {
    if(!seaLevelPressure_hPa) {
      seaLevelPressure_hPa = 1013.25;
    }

    return (1.0 - Math.pow(pressure_hPa / seaLevelPressure_hPa, (1 / 5.2553))) * 145366.45 * 0.3048;
  }

}

module.exports = BMP3xx;
