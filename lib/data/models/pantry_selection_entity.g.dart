// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pantry_selection_entity.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetPantrySelectionEntityCollection on Isar {
  IsarCollection<PantrySelectionEntity> get pantrySelectionEntitys =>
      this.collection();
}

const PantrySelectionEntitySchema = CollectionSchema(
  name: r'PantrySelectionEntity',
  id: 304980664399645417,
  properties: {
    r'ingredientId': PropertySchema(
      id: 0,
      name: r'ingredientId',
      type: IsarType.long,
    ),
    r'updatedAt': PropertySchema(
      id: 1,
      name: r'updatedAt',
      type: IsarType.dateTime,
    )
  },
  estimateSize: _pantrySelectionEntityEstimateSize,
  serialize: _pantrySelectionEntitySerialize,
  deserialize: _pantrySelectionEntityDeserialize,
  deserializeProp: _pantrySelectionEntityDeserializeProp,
  idName: r'id',
  indexes: {
    r'ingredientId': IndexSchema(
      id: 2486648196709662311,
      name: r'ingredientId',
      unique: true,
      replace: true,
      properties: [
        IndexPropertySchema(
          name: r'ingredientId',
          type: IndexType.value,
          caseSensitive: false,
        )
      ],
    )
  },
  links: {},
  embeddedSchemas: {},
  getId: _pantrySelectionEntityGetId,
  getLinks: _pantrySelectionEntityGetLinks,
  attach: _pantrySelectionEntityAttach,
  version: '3.1.0+1',
);

int _pantrySelectionEntityEstimateSize(
  PantrySelectionEntity object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  return bytesCount;
}

void _pantrySelectionEntitySerialize(
  PantrySelectionEntity object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeLong(offsets[0], object.ingredientId);
  writer.writeDateTime(offsets[1], object.updatedAt);
}

PantrySelectionEntity _pantrySelectionEntityDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = PantrySelectionEntity();
  object.id = id;
  object.ingredientId = reader.readLong(offsets[0]);
  object.updatedAt = reader.readDateTime(offsets[1]);
  return object;
}

P _pantrySelectionEntityDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readLong(offset)) as P;
    case 1:
      return (reader.readDateTime(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

Id _pantrySelectionEntityGetId(PantrySelectionEntity object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _pantrySelectionEntityGetLinks(
    PantrySelectionEntity object) {
  return [];
}

void _pantrySelectionEntityAttach(
    IsarCollection<dynamic> col, Id id, PantrySelectionEntity object) {
  object.id = id;
}

extension PantrySelectionEntityByIndex
    on IsarCollection<PantrySelectionEntity> {
  Future<PantrySelectionEntity?> getByIngredientId(int ingredientId) {
    return getByIndex(r'ingredientId', [ingredientId]);
  }

  PantrySelectionEntity? getByIngredientIdSync(int ingredientId) {
    return getByIndexSync(r'ingredientId', [ingredientId]);
  }

  Future<bool> deleteByIngredientId(int ingredientId) {
    return deleteByIndex(r'ingredientId', [ingredientId]);
  }

  bool deleteByIngredientIdSync(int ingredientId) {
    return deleteByIndexSync(r'ingredientId', [ingredientId]);
  }

  Future<List<PantrySelectionEntity?>> getAllByIngredientId(
      List<int> ingredientIdValues) {
    final values = ingredientIdValues.map((e) => [e]).toList();
    return getAllByIndex(r'ingredientId', values);
  }

  List<PantrySelectionEntity?> getAllByIngredientIdSync(
      List<int> ingredientIdValues) {
    final values = ingredientIdValues.map((e) => [e]).toList();
    return getAllByIndexSync(r'ingredientId', values);
  }

  Future<int> deleteAllByIngredientId(List<int> ingredientIdValues) {
    final values = ingredientIdValues.map((e) => [e]).toList();
    return deleteAllByIndex(r'ingredientId', values);
  }

  int deleteAllByIngredientIdSync(List<int> ingredientIdValues) {
    final values = ingredientIdValues.map((e) => [e]).toList();
    return deleteAllByIndexSync(r'ingredientId', values);
  }

  Future<Id> putByIngredientId(PantrySelectionEntity object) {
    return putByIndex(r'ingredientId', object);
  }

  Id putByIngredientIdSync(PantrySelectionEntity object,
      {bool saveLinks = true}) {
    return putByIndexSync(r'ingredientId', object, saveLinks: saveLinks);
  }

  Future<List<Id>> putAllByIngredientId(List<PantrySelectionEntity> objects) {
    return putAllByIndex(r'ingredientId', objects);
  }

  List<Id> putAllByIngredientIdSync(List<PantrySelectionEntity> objects,
      {bool saveLinks = true}) {
    return putAllByIndexSync(r'ingredientId', objects, saveLinks: saveLinks);
  }
}

extension PantrySelectionEntityQueryWhereSort
    on QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QWhere> {
  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QAfterWhere>
      anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QAfterWhere>
      anyIngredientId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        const IndexWhereClause.any(indexName: r'ingredientId'),
      );
    });
  }
}

extension PantrySelectionEntityQueryWhere on QueryBuilder<PantrySelectionEntity,
    PantrySelectionEntity, QWhereClause> {
  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QAfterWhereClause>
      idEqualTo(Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: id,
        upper: id,
      ));
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QAfterWhereClause>
      idNotEqualTo(Id id) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(
              IdWhereClause.lessThan(upper: id, includeUpper: false),
            )
            .addWhereClause(
              IdWhereClause.greaterThan(lower: id, includeLower: false),
            );
      } else {
        return query
            .addWhereClause(
              IdWhereClause.greaterThan(lower: id, includeLower: false),
            )
            .addWhereClause(
              IdWhereClause.lessThan(upper: id, includeUpper: false),
            );
      }
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QAfterWhereClause>
      idGreaterThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QAfterWhereClause>
      idLessThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QAfterWhereClause>
      idBetween(
    Id lowerId,
    Id upperId, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: lowerId,
        includeLower: includeLower,
        upper: upperId,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QAfterWhereClause>
      ingredientIdEqualTo(int ingredientId) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'ingredientId',
        value: [ingredientId],
      ));
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QAfterWhereClause>
      ingredientIdNotEqualTo(int ingredientId) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'ingredientId',
              lower: [],
              upper: [ingredientId],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'ingredientId',
              lower: [ingredientId],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'ingredientId',
              lower: [ingredientId],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'ingredientId',
              lower: [],
              upper: [ingredientId],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QAfterWhereClause>
      ingredientIdGreaterThan(
    int ingredientId, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'ingredientId',
        lower: [ingredientId],
        includeLower: include,
        upper: [],
      ));
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QAfterWhereClause>
      ingredientIdLessThan(
    int ingredientId, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'ingredientId',
        lower: [],
        upper: [ingredientId],
        includeUpper: include,
      ));
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QAfterWhereClause>
      ingredientIdBetween(
    int lowerIngredientId,
    int upperIngredientId, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'ingredientId',
        lower: [lowerIngredientId],
        includeLower: includeLower,
        upper: [upperIngredientId],
        includeUpper: includeUpper,
      ));
    });
  }
}

extension PantrySelectionEntityQueryFilter on QueryBuilder<
    PantrySelectionEntity, PantrySelectionEntity, QFilterCondition> {
  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity,
      QAfterFilterCondition> idEqualTo(Id value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity,
      QAfterFilterCondition> idGreaterThan(
    Id value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity,
      QAfterFilterCondition> idLessThan(
    Id value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity,
      QAfterFilterCondition> idBetween(
    Id lower,
    Id upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'id',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity,
      QAfterFilterCondition> ingredientIdEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'ingredientId',
        value: value,
      ));
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity,
      QAfterFilterCondition> ingredientIdGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'ingredientId',
        value: value,
      ));
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity,
      QAfterFilterCondition> ingredientIdLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'ingredientId',
        value: value,
      ));
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity,
      QAfterFilterCondition> ingredientIdBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'ingredientId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity,
      QAfterFilterCondition> updatedAtEqualTo(DateTime value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'updatedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity,
      QAfterFilterCondition> updatedAtGreaterThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'updatedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity,
      QAfterFilterCondition> updatedAtLessThan(
    DateTime value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'updatedAt',
        value: value,
      ));
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity,
      QAfterFilterCondition> updatedAtBetween(
    DateTime lower,
    DateTime upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'updatedAt',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }
}

extension PantrySelectionEntityQueryObject on QueryBuilder<
    PantrySelectionEntity, PantrySelectionEntity, QFilterCondition> {}

extension PantrySelectionEntityQueryLinks on QueryBuilder<PantrySelectionEntity,
    PantrySelectionEntity, QFilterCondition> {}

extension PantrySelectionEntityQuerySortBy
    on QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QSortBy> {
  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QAfterSortBy>
      sortByIngredientId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'ingredientId', Sort.asc);
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QAfterSortBy>
      sortByIngredientIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'ingredientId', Sort.desc);
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QAfterSortBy>
      sortByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.asc);
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QAfterSortBy>
      sortByUpdatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.desc);
    });
  }
}

extension PantrySelectionEntityQuerySortThenBy
    on QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QSortThenBy> {
  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QAfterSortBy>
      thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.asc);
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QAfterSortBy>
      thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.desc);
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QAfterSortBy>
      thenByIngredientId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'ingredientId', Sort.asc);
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QAfterSortBy>
      thenByIngredientIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'ingredientId', Sort.desc);
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QAfterSortBy>
      thenByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.asc);
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QAfterSortBy>
      thenByUpdatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'updatedAt', Sort.desc);
    });
  }
}

extension PantrySelectionEntityQueryWhereDistinct
    on QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QDistinct> {
  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QDistinct>
      distinctByIngredientId() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'ingredientId');
    });
  }

  QueryBuilder<PantrySelectionEntity, PantrySelectionEntity, QDistinct>
      distinctByUpdatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'updatedAt');
    });
  }
}

extension PantrySelectionEntityQueryProperty on QueryBuilder<
    PantrySelectionEntity, PantrySelectionEntity, QQueryProperty> {
  QueryBuilder<PantrySelectionEntity, int, QQueryOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'id');
    });
  }

  QueryBuilder<PantrySelectionEntity, int, QQueryOperations>
      ingredientIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'ingredientId');
    });
  }

  QueryBuilder<PantrySelectionEntity, DateTime, QQueryOperations>
      updatedAtProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'updatedAt');
    });
  }
}
