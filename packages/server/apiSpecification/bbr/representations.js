"use strict";

const {createRowFormatter, getAllProvidedAttributes, getAttributeBinding} = require('../replikering/bindings/util');
const grbbrModels = require('../../ois2/parse-ea-model');
const {getReplicationBinding} = require('../../ois2/replication-models');
const {getRelationsForEntity} = require('../../ois2/relations');
const {makeRefObj, geojsonFields, getEntityName} = require('./common');
const {addGeojsonRepresentationsUsingBinding} = require('../common/representationUtil');
const registry = require('../registry');
const createFlatFormatter = (grbbrModel) => {
  const binding = getReplicationBinding(grbbrModel.name, 'current');
  const basicRowFormatter = createRowFormatter(binding);
  const relations = getRelationsForEntity(grbbrModel.name);
  return baseUrl => row => {
    const formattedRow = basicRowFormatter(row);
    for (let relation of relations) {
      const id = formattedRow[relation.attribute];
      delete formattedRow[relation.attribute];
      if (id) {
        let refObj = makeRefObj(baseUrl, relation.references, id);
        for (let [key, val] of Object.entries(refObj)) {
          formattedRow[`${relation.attribute}_${key}`] = val;
        }
      }
    }
    return formattedRow;
  };
};

const makeFlatRepresentation = (grbbrModel) => {
  const binding = getReplicationBinding(grbbrModel.name, 'current');
  return {
    fields: [],
    outputFields: getAllProvidedAttributes(binding.attributes),
    mapper: createFlatFormatter(grbbrModel)
  };
};
const createJsonFormatter = (grbbrModel) => {
  const binding = getReplicationBinding(grbbrModel.name, 'current');
  const basicRowFormatter = createRowFormatter(binding);
  const relations = getRelationsForEntity(grbbrModel.name);
  return baseUrl => row => {
    const formattedRow = basicRowFormatter(row);
    for (let relation of relations) {
      const id = formattedRow[relation.attribute];
      if (id) {
        formattedRow[relation.attribute] = makeRefObj(baseUrl, relation.references, id);
      }
    }
    return formattedRow;
  };
};

const makeJsonRepresentation = (grbbrModel) => {
  return {
    fields: [],
    mapper: createJsonFormatter(grbbrModel)
  };
};

const makeRepresentations = grbbrModel => {
  const representations = {
    flat: makeFlatRepresentation(grbbrModel),
    json: makeJsonRepresentation(grbbrModel)
  };
  if(geojsonFields[grbbrModel.name]) {
    const binding = getReplicationBinding(grbbrModel.name, 'current');
    const geometryAttrBinding = getAttributeBinding(geojsonFields[grbbrModel.name], binding);
    addGeojsonRepresentationsUsingBinding(representations, geometryAttrBinding);
  }
  return representations;
};
for(let grbbrModel of grbbrModels) {
  exports[grbbrModel.name] = makeRepresentations(grbbrModel);
  registry.addMultiple(getEntityName(grbbrModel), 'representation', exports[grbbrModel.name]);
}