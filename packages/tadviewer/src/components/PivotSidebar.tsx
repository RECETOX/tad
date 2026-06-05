import * as React from "react";
import * as actions from "../actions";
import { Sidebar } from "./Sidebar";
import { ColumnSelector } from "./ColumnSelector";
import { SingleColumnSelect } from "./SingleColumnSelect";
import { PivotOrderPanel } from "./PivotOrderPanel";
import { DisplayOrderPanel } from "./DisplayOrderPanel";
import { SortOrderPanel } from "./SortOrderPanel";
import { AggPanel } from "./AggPanel";
import { FormatPanel } from "./FormatPanel";
import { Checkbox, Tabs, Tab } from "@blueprintjs/core";
import * as reltab from "reltab";
import { ViewParams } from "../ViewParams";
import { StateRef, update } from "oneref";
import { AppState } from "../AppState";
import { FilterEditor } from "./FilterEditor";
import { useState } from "react";

export interface PivotSidebarProps {
  expanded: boolean;
  schema: reltab.Schema;
  viewParams: ViewParams;
  delayedCalcMode: boolean;
  onColumnClick?: (cid: string) => void;
  embedded: boolean;
  stateRef: StateRef<AppState>;
  appState: AppState; // Add this!
  onFilter?: (filterExp: reltab.FilterExp) => void; // Add this!
}

export const PivotSidebar: React.FC<PivotSidebarProps> = ({
  expanded,
  schema,
  viewParams,
  delayedCalcMode,
  onColumnClick,
  embedded,
  stateRef,
  appState, // Destructure here
  onFilter  // Destructure here
}) => {
  const onLeafColumnSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selStr = event.target.value;
    const cid = selStr === "__none" ? null : selStr;
    // console.log("onLeafColumnSelect: ", cid);
    update(
      stateRef,
      (appState) =>
        appState.setIn(
          ["viewState", "viewParams", "pivotLeafColumn"],
          cid
        ) as AppState
    );
  };

  const handleFilterApply = (filterExp: reltab.FilterExp) => {
    actions.setFilter(filterExp, stateRef);
    if (onFilter) {
      onFilter(filterExp);
    }
  };

  const handleFilterCancel = () => {
    // A sensible default for "Cancel" inside a side panel
    // is simply clearing out the filter query entirely:
    actions.setFilter(new reltab.FilterExp(), stateRef);
  };

  const handleFilterDone = () => {
    // In a Tab layout, hitting 'Done' doesn't need to close anything.
    // It can just remain blank, or you might choose to programmatically
    // change the active Tab back to "Order" or "Pivot" if preferred.
  };

  const expandClass = expanded ? "sidebar-expanded" : "sidebar-collapsed";
  const pivotPanel = (
    <PivotOrderPanel
      schema={schema}
      viewParams={viewParams}
      stateRef={stateRef}
    />
  );
  const displayPanel = (
    <DisplayOrderPanel
      schema={schema}
      viewParams={viewParams}
      stateRef={stateRef}
    />
  );
  const sortPanel = (
    <SortOrderPanel
      schema={schema}
      viewParams={viewParams}
      stateRef={stateRef}
    />
  );
  const aggPanel = (
    <AggPanel schema={schema} viewParams={viewParams} stateRef={stateRef} />
  );
  const formatPanel = (
    <FormatPanel schema={schema} viewParams={viewParams} stateRef={stateRef} />
  );

  const filterPanel = (
    <FilterEditor
      appState={appState}
      stateRef={stateRef}
      schema={schema} // schema is already passed to PivotSidebar as baseSchema
      filterExp={viewParams.filterExp}
      onCancel={handleFilterCancel}
      onApply={handleFilterApply}
      onDone={handleFilterDone}
    />
  );

  const columnHistoCheckElem = (
    <Checkbox
      className="bp4-condensed"
      checked={viewParams.showColumnHistograms}
      onChange={() => actions.toggleShowColumnHistograms(stateRef)}
      label="Show Numeric Column Histograms"
    />
  );

  return (
    <Sidebar expanded={expanded}>
      <div className="ui-block">
        <h5 className="bp4-heading">General</h5>
        <div className="root-check-group">
          {columnHistoCheckElem}
          <Checkbox
            className="bp4-condensed"
            checked={viewParams.showRoot}
            onChange={() => actions.toggleShowRoot(stateRef)}
            label="Show Global Aggregations as Top Row"
          />
        </div>
      </div>
      <div className="ui-block">
        <h5 className="bp4-heading">Columns</h5>
        <ColumnSelector
          schema={schema}
          viewParams={viewParams}
          onColumnClick={onColumnClick}
          stateRef={stateRef}
        />
        <SingleColumnSelect
          schema={schema}
          label="Pivot Tree Leaf Level"
          value={viewParams.pivotLeafColumn}
          disabled={viewParams.vpivots.length === 0}
          onChange={(e) => onLeafColumnSelect(e)}
        />
      </div>
      <div className="ui-block addl-col-props">
        <h5 className="bp4-heading">Additional Properties</h5>
        <Tabs animate={false} id="ColumnPropTabs">
          <Tab id="shownColumnsTab" title="Order" panel={displayPanel} />
          <Tab id="pivotColumnsTab" title="Pivot" panel={pivotPanel} />
          <Tab id="sortColumnsTab" title="Sort" panel={sortPanel} />
          <Tab id="aggColumnsTab" title="Aggregations" panel={aggPanel} />
          <Tab id="formatColumnsTab" title="Format" panel={formatPanel} />
          {/* <Tab id="filterColumnsTab" title="Filter" panel={filterPanel} /> <-- Add this! */}
        </Tabs>
      </div>
      <div className="ui-block filter-section">
        <h5 className="bp4-heading">Filter</h5>
        {filterPanel}
      </div>
    </Sidebar>
  );
};
