process.env.NODE_ENV = 'test';

const chai   = require('chai');
const BMP3xx = require('../BMP3xx.js');
const expect = chai.expect;

describe('bme280-sensor', () => {
  it('it should communicate with the device', (done) => {
    const bme280 = new BMP3xx();
    expect(bme280).to.be.an.instanceof(BMP3xx);
    bme280.init()
      .then((chipId) => {
        expect(chipId).to.be.equal(BMP3xx.CHIP_ID_BMP3xx());
        done();
      })
      .catch((err) => {
        done(err);
      });
  });

  it('it should receive valid sensor data', (done) => {
    const bme280 = new BMP3xx();
    expect(bme280).to.be.an.instanceof(BMP3xx);
    bme280.init()
      .then((chipId) => {
        expect(chipId).to.be.equal(BMP3xx.CHIP_ID_BMP3xx());
        return bme280.readSensorData();
      })
      .then((data) => {
        console.log(`BMP3xx sensor data: ${JSON.stringify(data)}`);
        expect(data).to.have.all.keys('temperature_C', 'humidity', 'pressure_hPa');
        expect(data.temperature_C).to.be.within(-40, 85); // per Bosch BMP3xx datasheet operating range
        expect(data.humidity).to.be.within(0, 100); // per Bosch BMP3xx datasheet operating range
        expect(data.pressure_hPa).to.be.within(300, 1100); // per Bosch BMP3xx datasheet operating range
        done();
      })
      .catch((err) => {
        done(err);
      });
  });
});
