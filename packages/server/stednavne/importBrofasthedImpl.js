const { go } = require('ts-csp');

const {streamCsvToTable} = require('@dawadk/import-util/src/postgres-streaming');
const tableDiffNg = require('@dawadk/import-util/src/table-diff');
const materialize = require('@dawadk/import-util/src/materialize');
const { materializeDawa } = require('../importUtil/materialize-dawa');
const tableSchema = require('../psql/tableModel');
module.exports = (client, txid, filePath, init) => go(function*() {
  yield client.query('create temp table fetch_brofasthed as (select * from brofasthed where false)');
  yield streamCsvToTable(client, filePath, 'fetch_brofasthed', ['stedid', 'brofast']);
  yield tableDiffNg.computeDifferences(client, txid, `fetch_brofasthed`, tableSchema.tables.brofasthed);
  yield tableDiffNg.applyChanges(client, txid, tableSchema.tables.brofasthed);
  yield materializeDawa(client, txid);
  if(init) {
    yield materialize.makeChangesNonPublic(client, txid, tableSchema.tables.brofasthed);
    yield materialize.makeChangesNonPublic(client, txid, tableSchema.tables.ikke_brofaste_adresser);
  }
});