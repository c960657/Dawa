DROP TABLE IF EXISTS gt_pk_metadata;
CREATE TABLE public.gt_pk_metadata (
  table_schema VARCHAR(32) NOT NULL,
  table_name VARCHAR(32) NOT NULL,
  pk_column VARCHAR(32) NOT NULL,
  pk_column_idx INTEGER,
  pk_policy VARCHAR(32),
  pk_sequence VARCHAR(64),
  unique (table_schema, table_name, pk_column),
  check (pk_policy in ('sequence', 'assigned', 'autogenerated'))
);

insert into gt_pk_metadata values('public', 'wfs_adgangsadresser', 'id', 0, 'assigned', null);
insert into gt_pk_metadata values('public', 'wfs_adresser', 'id', 0, 'assigned', null);
insert into gt_pk_metadata values('public', 'wms_vejpunktlinjer', 'id', 0, 'assigned', null);
insert into gt_pk_metadata values('public', 'wms_vejpunkter', 'id', 0, 'assigned', null);

DROP MATERIALIZED VIEW IF EXISTS wms_vejpunktlinjer;
CREATE MATERIALIZED VIEW wms_vejpunktlinjer AS (
  SELECT
    adgangsadresser_mat.id :: TEXT                                           AS id,
    adgangsadresser_mat.objekttype                                           AS status,
    st_makeline(adgangsadresser_mat.vejpunkt_geom, adgangsadresser_mat.geom) AS vejpunktlinje
  FROM adgangsadresser_mat
);

CREATE UNIQUE INDEX ON wms_vejpunktlinjer(id);
CREATE  INDEX ON wms_vejpunktlinjer USING GIST(vejpunktlinje);
CREATE INDEX ON adgangsadresser_mat(postnr, id);
CREATE INDEX ON adresser_mat(postnr, id);