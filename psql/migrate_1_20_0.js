"use strict";

const {go} = require('ts-csp');
const cliParameterParsing = require('../bbr/common/cliParameterParsing');
const proddb = require('./proddb');

const { reloadDatabaseCode } = require('./initialization');
const {withImportTransaction} = require('../importUtil/importUtil');
const optionSpec = {
  pgConnectionUrl: [false, 'URL som anvendes ved forbindelse til test database', 'string']
};


cliParameterParsing.main(optionSpec, Object.keys(optionSpec), function (args, options) {
  proddb.init({
    connString: options.pgConnectionUrl,
    pooled: false
  });
  proddb.withTransaction('READ_WRITE', (client) => go(function* () {
    yield reloadDatabaseCode(client, 'psql/schema');
    yield withImportTransaction(client, 'migrate_1_20_0', txid => go(function*() {
      yield client.query('DELETE FROM jordstykker_changes');
      yield client.query(`INSERT INTO jordstykker_changes(txid, operation,public,ejerlavkode,matrikelnr,kommunekode,regionskode,sognekode,retskredskode,esrejendomsnr,sfeejendomsnr,udvidet_esrejendomsnr,geom)
      (SELECT ${txid}, 'insert', 'false', ejerlavkode,matrikelnr,kommunekode,regionskode,sognekode,retskredskode,esrejendomsnr,sfeejendomsnr,udvidet_esrejendomsnr,geom FROM jordstykker)`);
      yield client.query('ALTER TABLE ejerlav ADD COLUMN ændret timestamptz not null default now()');
      yield client.query('ALTER TABLE ejerlav ADD COLUMN geo_ændret timestamptz not null default now()');
      yield client.query('ALTER TABLE ejerlav ADD COLUMN geo_version integer not null default 1');
      yield client.query('ALTER TABLE ejerlav ADD COLUMN geom geometry(multipolygon, 25832)');
      yield client.query('ALTER TABLE ejerlav_changes ADD COLUMN ændret timestamptz default now()');
      yield client.query('ALTER TABLE ejerlav_changes ADD COLUMN geo_ændret timestamptz default now()');
      yield client.query('ALTER TABLE ejerlav_changes ADD COLUMN geo_version integer default 1');
      yield client.query('ALTER TABLE ejerlav_changes ADD COLUMN geom geometry(multipolygon, 25832)');
      yield client.query('ALTER TABLE ejerlav alter column ændret DROP DEFAULT');
      yield client.query('ALTER TABLE ejerlav alter column GEO_ændret DROP DEFAULT');
      yield client.query('ALTER TABLE ejerlav alter column geo_version DROP DEFAULT');
      yield client.query('ALTER TABLE ejerlav_changes alter column ændret DROP DEFAULT');
      yield client.query('ALTER TABLE ejerlav_changes alter column GEO_ændret DROP DEFAULT');
      yield client.query('ALTER TABLE ejerlav_changes alter column geo_version DROP DEFAULT');
    }));
    yield client.query('analyze');
  })).done();
});
