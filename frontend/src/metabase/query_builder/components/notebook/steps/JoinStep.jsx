import React, { useRef } from "react";
import PropTypes from "prop-types";
import _ from "underscore";
import { t } from "ttag";

import PopoverWithTrigger from "metabase/components/PopoverWithTrigger";

import { DatabaseSchemaAndTableDataSelector } from "metabase/query_builder/components/DataSelector";
import FieldList from "metabase/query_builder/components/FieldList";
import Join from "metabase-lib/lib/queries/structured/Join";

import {
  NotebookCell,
  NotebookCellItem,
  NotebookCellAdd,
} from "../NotebookCell";
import { FieldsPickerIcon, FIELDS_PICKER_STYLES } from "../FieldsPickerIcon";
import FieldsPicker from "./FieldsPicker";
import {
  DimensionSourceName,
  JoinStepRoot,
  JoinClausesContainer,
  JoinClauseRoot,
  JoinClauseContainer,
  JoinStrategyIcon,
  JoinTypeSelectRoot,
  JoinTypeOptionRoot,
  JoinTypeIcon,
  JoinDimensionControlsContainer,
  JoinWhereConditionLabelContainer,
  JoinWhereConditionLabel,
  JoinConditionLabel,
  RemoveJoinIcon,
} from "./JoinStep.styled";

const stepShape = {
  id: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  query: PropTypes.object.isRequired,
  previewQuery: PropTypes.object,
  valid: PropTypes.bool.isRequired,
  visible: PropTypes.bool.isRequired,
  stageIndex: PropTypes.number.isRequired,
  itemIndex: PropTypes.number.isRequired,
  update: PropTypes.func.isRequired,
  revert: PropTypes.func.isRequired,
  clean: PropTypes.func.isRequired,
  actions: PropTypes.array.isRequired,

  previous: stepShape,
  next: stepShape,
};

const joinStepPropTypes = {
  query: PropTypes.object.isRequired,
  step: PropTypes.shape(stepShape).isRequired,
  color: PropTypes.string,
  isLastOpened: PropTypes.bool,
  updateQuery: PropTypes.func.isRequired,
};

export default function JoinStep({
  color,
  query,
  step,
  updateQuery,
  isLastOpened,
}) {
  const isSingleJoinStep = step.itemIndex != null;
  let joins = query.joins();
  if (isSingleJoinStep) {
    const join = joins[step.itemIndex];
    joins = join ? [join] : [];
  }
  if (joins.length === 0) {
    joins = [new Join({ fields: "all" }, query.joins().length, query)];
  }
  const valid = _.all(joins, join => join.isValid());

  function addNewJoinClause() {
    query.join(new Join({ fields: "all" })).update(updateQuery);
  }

  return (
    <JoinStepRoot>
      <JoinClausesContainer>
        {joins.map((join, index) => {
          const isLast = index === joins.length - 1;
          return (
            <JoinClauseContainer key={index} isLast={isLast}>
              <JoinClause
                join={join}
                color={color}
                showRemove={joins.length > 1}
                updateQuery={updateQuery}
                isLastOpened={isLastOpened && isLast}
              />
            </JoinClauseContainer>
          );
        })}
      </JoinClausesContainer>
      {!isSingleJoinStep && valid && (
        <NotebookCellAdd
          color={color}
          className="cursor-pointer ml-auto"
          onClick={addNewJoinClause}
        />
      )}
    </JoinStepRoot>
  );
}

JoinStep.propTypes = joinStepPropTypes;

const joinClausePropTypes = {
  color: PropTypes.string,
  join: PropTypes.object,
  updateQuery: PropTypes.func,
  showRemove: PropTypes.bool,
};

function JoinClause({ color, join, updateQuery, showRemove }) {
  const joinDimensionPickersRef = useRef([]);
  const parentDimensionPickersRef = useRef([]);

  const query = join.query();
  if (!query) {
    return null;
  }

  const parentDimensions = join.parentDimensions();
  const parentDimensionOptions = join.parentDimensionOptions();
  const joinDimensions = join.joinDimensions();
  const joinDimensionOptions = join.joinDimensionOptions();

  const joinedTable = join.joinedTable();

  const joinConditions = join.getConditions();
  const displayConditions = joinConditions.length > 0 ? joinConditions : [[]];

  let lhsTable;
  if (join.index() === 0) {
    // first join's lhs is always the parent table
    lhsTable = join.parentTable();
  } else if (join.parentDimension()) {
    // subsequent can be one of the previously joined tables
    // NOTE: `lhsDimension` would probably be a better name for `parentDimension`
    lhsTable = join.parentDimensions()[0].field().table;
  }

  function onSourceTableSet(newJoin) {
    if (!newJoin.parentDimensions().length) {
      setTimeout(() => {
        parentDimensionPickersRef.current[0]?.open();
      });
    }
  }

  function onParentDimensionChange(index, fieldRef) {
    join
      .setParentDimension({ index, dimension: fieldRef })
      .setDefaultAlias()
      .parent()
      .update(updateQuery);
    if (!join.joinDimensions[index]) {
      joinDimensionPickersRef.current[index]?.open();
    }
  }

  function onJoinDimensionChange(index, fieldRef) {
    join
      .setJoinDimension({ index, dimension: fieldRef })
      .parent()
      .update(updateQuery);
  }

  function addNewDimensionsPair(index) {
    join
      .addEmptyDimensionsPair()
      .parent()
      .update(updateQuery);
    setTimeout(() => {
      parentDimensionPickersRef.current[index]?.open();
    });
  }

  function removeJoin() {
    join.remove().update(updateQuery);
  }

  return (
    <JoinClauseRoot>
      <NotebookCell color={color} flex={1} alignSelf="start">
        <NotebookCellItem color={color}>
          {lhsTable?.displayName() || t`Previous results`}
        </NotebookCellItem>

        <JoinTypePicker join={join} color={color} updateQuery={updateQuery} />

        <JoinTablePicker
          join={join}
          query={query}
          joinedTable={joinedTable}
          color={color}
          updateQuery={updateQuery}
          onSourceTableSet={onSourceTableSet}
        />
      </NotebookCell>

      {joinedTable && (
        <React.Fragment>
          <JoinWhereConditionLabelContainer>
            <JoinWhereConditionLabel />
          </JoinWhereConditionLabelContainer>
          <NotebookCell
            color={color}
            flex={1}
            flexDirection="column"
            align="start"
            padding="8px"
          >
            {displayConditions.map((condition, index) => {
              const isLast = index === displayConditions.length - 1;

              function removeDimensionPair() {
                join
                  .removeCondition(index)
                  .parent()
                  .update(updateQuery);
              }

              return (
                <JoinDimensionControlsContainer
                  key={index}
                  isFirst={index === 0}
                  data-testid={`join-dimensions-pair-${index}`}
                >
                  <JoinDimensionPicker
                    color={color}
                    query={query}
                    dimension={parentDimensions[index]}
                    options={parentDimensionOptions}
                    onChange={fieldRef =>
                      onParentDimensionChange(index, fieldRef)
                    }
                    ref={ref =>
                      (parentDimensionPickersRef.current[index] = ref)
                    }
                    data-testid="parent-dimension"
                  />
                  <JoinConditionLabel>=</JoinConditionLabel>
                  <JoinDimensionPicker
                    color={color}
                    query={query}
                    dimension={joinDimensions[index]}
                    options={joinDimensionOptions}
                    onChange={fieldRef =>
                      onJoinDimensionChange(index, fieldRef)
                    }
                    ref={ref => (joinDimensionPickersRef.current[index] = ref)}
                    data-testid="join-dimension"
                  />
                  {isLast ? (
                    join.isValid() ? (
                      <NotebookCellAdd
                        color={color}
                        className="cursor-pointer ml-auto"
                        onClick={() => {
                          addNewDimensionsPair(index + 1);
                        }}
                      />
                    ) : (
                      <RemoveJoinIcon onClick={removeDimensionPair} size={12} />
                    )
                  ) : (
                    <JoinConditionLabel>{t`on`}</JoinConditionLabel>
                  )}
                </JoinDimensionControlsContainer>
              );
            })}
          </NotebookCell>
        </React.Fragment>
      )}

      {showRemove && <RemoveJoinIcon onClick={removeJoin} />}
    </JoinClauseRoot>
  );
}

JoinClause.propTypes = joinClausePropTypes;

const joinTablePickerPropTypes = {
  join: PropTypes.object,
  query: PropTypes.object,
  joinedTable: PropTypes.object,
  color: PropTypes.string,
  updateQuery: PropTypes.func,
  onSourceTableSet: PropTypes.func.isRequired,
};

function JoinTablePicker({
  join,
  query,
  joinedTable,
  color,
  updateQuery,
  onSourceTableSet,
}) {
  const databases = [
    query.database(),
    query.database().savedQuestionsDatabase(),
  ].filter(Boolean);

  function onChange(tableId) {
    const newJoin = join
      .setJoinSourceTableId(tableId)
      .setDefaultCondition()
      .setDefaultAlias();
    newJoin.parent().update(updateQuery);
    onSourceTableSet(newJoin);
  }

  return (
    <NotebookCellItem
      color={color}
      inactive={!joinedTable}
      right={
        joinedTable && (
          <JoinFieldsPicker
            join={join}
            updateQuery={updateQuery}
            triggerElement={<FieldsPickerIcon />}
            triggerStyle={FIELDS_PICKER_STYLES.trigger}
          />
        )
      }
      rightContainerStyle={FIELDS_PICKER_STYLES.notebookItemContainer}
    >
      <DatabaseSchemaAndTableDataSelector
        hasTableSearch
        canChangeDatabase={false}
        databases={databases}
        tableFilter={table => table.db_id === query.database().id}
        selectedDatabaseId={query.databaseId()}
        selectedTableId={join.joinSourceTableId()}
        setSourceTableFn={onChange}
        isInitiallyOpen={join.joinSourceTableId() == null}
        triggerElement={
          joinedTable ? joinedTable.displayName() : t`Pick a table...`
        }
      />
    </NotebookCellItem>
  );
}

JoinTablePicker.propTypes = joinTablePickerPropTypes;

const joinTypePickerPropTypes = {
  join: PropTypes.object,
  color: PropTypes.string,
  updateQuery: PropTypes.func,
};

function JoinTypePicker({ join, color, updateQuery }) {
  const strategyOption = join.strategyOption();

  function onChange(strategy) {
    join
      .setStrategy(strategy)
      .parent()
      .update(updateQuery);
  }

  return (
    <PopoverWithTrigger
      triggerElement={
        strategyOption ? (
          <JoinStrategyIcon
            tooltip={t`Change join type`}
            name={strategyOption.icon}
          />
        ) : (
          <NotebookCellItem color={color}>
            {`Choose a join type`}
          </NotebookCellItem>
        )
      }
    >
      {({ onClose }) => (
        <JoinTypeSelect
          value={strategyOption && strategyOption.value}
          onChange={strategy => {
            onChange(strategy);
            onClose();
          }}
          options={join.strategyOptions()}
        />
      )}
    </PopoverWithTrigger>
  );
}

JoinTypePicker.propTypes = joinTypePickerPropTypes;

const joinStrategyOptionShape = {
  name: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  icon: PropTypes.string.isRequired,
};

const joinTypeSelectPropTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(PropTypes.shape(joinStrategyOptionShape))
    .isRequired,
};

function JoinTypeSelect({ value, onChange, options }) {
  return (
    <JoinTypeSelectRoot>
      {options.map(option => (
        <JoinTypeOption
          {...option}
          key={option.value}
          selected={value === option.value}
          onChange={onChange}
        />
      ))}
    </JoinTypeSelectRoot>
  );
}

JoinTypeSelect.propTypes = joinTypeSelectPropTypes;

const joinTypeOptionPropTypes = {
  ...joinStrategyOptionShape,
  selected: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
};

function JoinTypeOption({ name, value, icon, selected, onChange }) {
  return (
    <JoinTypeOptionRoot isSelected={selected} onClick={() => onChange(value)}>
      <JoinTypeIcon name={icon} isSelected={selected} />
      {name}
    </JoinTypeOptionRoot>
  );
}

JoinTypeOption.propTypes = joinTypeOptionPropTypes;

const joinDimensionPickerPropTypes = {
  dimension: PropTypes.object,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.shape({
    count: PropTypes.number.isRequired,
    fks: PropTypes.array.isRequired,
    dimensions: PropTypes.arrayOf(PropTypes.object).isRequired,
  }).isRequired,
  query: PropTypes.object.isRequired,
  color: PropTypes.string,
  "data-testid": PropTypes.string,
};

class JoinDimensionPicker extends React.Component {
  open() {
    this._popover.open();
  }
  render() {
    const { dimension, onChange, options, query, color } = this.props;
    const testID = this.props["data-testid"] || "join-dimension";
    return (
      <PopoverWithTrigger
        ref={ref => (this._popover = ref)}
        triggerElement={
          <NotebookCellItem
            color={color}
            inactive={!dimension}
            data-testid={testID}
          >
            <div>
              {dimension && (
                <DimensionSourceName>
                  {dimension
                    .query()
                    .table()
                    .displayName()}
                </DimensionSourceName>
              )}
              {dimension?.displayName() || t`Pick a column...`}
            </div>
          </NotebookCellItem>
        }
      >
        {({ onClose }) => (
          <FieldList
            className="text-brand"
            field={dimension && dimension.mbql()}
            fieldOptions={options}
            table={query.table()}
            query={query}
            onFieldChange={field => {
              onChange(field);
              onClose();
            }}
            data-testid={`${testID}-picker`}
          />
        )}
      </PopoverWithTrigger>
    );
  }
}

JoinDimensionPicker.propTypes = joinDimensionPickerPropTypes;

const joinFieldsPickerPropTypes = {
  join: PropTypes.object.isRequired,
  updateQuery: PropTypes.func.isRequired,
};

const JoinFieldsPicker = ({ join, updateQuery, ...props }) => {
  const dimensions = join.joinedDimensions();
  const selectedDimensions = join.fieldsDimensions();
  const selected = new Set(selectedDimensions.map(d => d.key()));

  function onSelectAll() {
    join
      .setFields("all")
      .parent()
      .update(updateQuery);
  }

  function onSelectNone() {
    join
      .setFields("none")
      .parent()
      .update(updateQuery);
  }

  function onToggleDimension(dimension) {
    join
      .setFields(
        dimensions
          .filter(d => {
            if (d === dimension) {
              return !selected.has(d.key());
            } else {
              return selected.has(d.key());
            }
          })
          .map(d => d.mbql()),
      )
      .parent()
      .update(updateQuery);
  }

  return (
    <FieldsPicker
      {...props}
      dimensions={dimensions}
      selectedDimensions={selectedDimensions}
      isAll={join.fields === "all"}
      isNone={join.fields === "none"}
      onSelectAll={onSelectAll}
      onSelectNone={onSelectNone}
      onToggleDimension={onToggleDimension}
    />
  );
};

JoinFieldsPicker.propTypes = joinFieldsPickerPropTypes;
