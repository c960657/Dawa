"use strict";

const {go} = require('ts-csp');

const importUtil = require('../importUtil/importUtil');
const tableDiffNg = require('../importUtil/tableDiffNg');
const tableModel = require('../psql/tableModel');
const {materializeDawa, recomputeMaterializedDawa} = require('../importUtil/materialize');
const logger = require('../logger').forCategory('vejpunkter');

const VEJPUNKTER_COLUMNS = ['id', 'husnummerid', 'kilde', 'noejagtighedsklasse', 'tekniskstandard', 'geom'];

const tekniskStandardMap = {
  10: 'V0',
  20: 'V1',
  30: 'V2',
  40: 'V2',
  50: 'V3',
  60: 'V3',
  70: 'V4',
  80: 'V4',
  90: 'V5',
  100: 'V6',
  110: 'V7',
  120: 'V8',
  130: 'V9',
  140: 'V9',
  200: 'VX'
};

function loadVejpunktCsv(client, inputFile, tableName) {
  return importUtil.streamCsvToTable(client, inputFile, tableName, VEJPUNKTER_COLUMNS,
    row => (
      {
        id: row.id,
        husnummerid: row.husnummerId,
        kilde: row.kilde,
        noejagtighedsklasse: row.nøjagtighedsklasse,
        tekniskstandard: tekniskStandardMap[row.tekniskStandard],
        geom: 'SRID=25832;'+row.position
      }));
}

const vejpunkterTableModel = tableModel.tables.vejpunkter;

module.exports = (client, txid, inputFile) => go(function*() {
  const existingCount = (yield client.queryRows('select coalesce((select count(*) from vejpunkter), 0) as c'))[0].c;
  if(existingCount > 0) {
    yield importUtil.createTempTableFromTemplate(client, 'updated_vejpunkter', 'vejpunkter', VEJPUNKTER_COLUMNS);
    yield loadVejpunktCsv(client, inputFile, 'updated_vejpunkter');
    yield tableDiffNg.computeDifferences(client, txid, 'updated_vejpunkter', vejpunkterTableModel);
    yield importUtil.dropTable(client, 'updated_vejpunkter');
    yield tableDiffNg.applyChanges(client, txid, vejpunkterTableModel);
    yield materializeDawa(client, txid);
  }
  else {
    logger.info("Initialiserer vejpunkter");
    yield loadVejpunktCsv(client, inputFile, 'vejpunkter');
    yield recomputeMaterializedDawa(client, txid);
  }
});