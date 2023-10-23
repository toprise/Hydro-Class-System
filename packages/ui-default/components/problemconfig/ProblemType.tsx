import {
  Card, Classes, Switch, Tab, Tabs,
} from '@blueprintjs/core';
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { i18n } from 'vj/utils';
import { testlibCheckers } from '../monaco/schema/problemconfig';
import { FormItem, ManagedSelect, SingleFileSelect } from './BasicForm';
import type { RootState } from './reducer/index';

export default function ProblemType() {
  const Type = useSelector((state: RootState) => state.config.type);
  const checkerType = useSelector((state: RootState) => state.config.checker_type);
  const filename = useSelector((state: RootState) => state.config.filename);
  const subType = useSelector((state: RootState) => state.config.subType);
  const checker = useSelector((state: RootState) => state.config.checker);
  const [category, setCategory] = React.useState(checker?.includes('.') ? 'preset' : 'custom');
  const dispatch = useDispatch();
  const dispatcher = (base) => (value) => dispatch({ ...base, value });
  return (
    <FormItem columns={12} label="" disableLabel>
      <Card style={{ padding: 10 }}>
        <Tabs
          id="ProblemTypeTabs"
          selectedTabId={Type}
          onChange={dispatcher({ type: 'CONFIG_FORM_UPDATE', key: 'type' })}
          defaultSelectedTabId="default"
          renderActiveTabPanelOnly
        >
          <span className={Classes.TAB}>{i18n('Problem Type')}</span>
          <Tabs.Expander />
          <Tab
            id="default"
            title={i18n('problem_type.default')}
            panel={(
              <Tabs
                id="CheckerTypeTabs"
                selectedTabId={
                  ['strict', 'default'].includes(checkerType) || !checkerType
                    ? 'default' : (checkerType !== 'testlib' ? 'other' : 'testlib')
                }
                onChange={dispatcher({ type: 'CONFIG_FORM_UPDATE', key: 'checker_type' })}
                renderActiveTabPanelOnly
              >
                <span className={Classes.TAB}>{i18n('CheckerType')}</span>
                <Tabs.Expander />
                <Tab
                  id="default"
                  title={i18n('default')}
                  panel={(
                    <div className="row">
                      <FormItem columns={12} label="Config">
                        <Switch
                          checked={checkerType !== 'strict'}
                          label={i18n('Ignore trailing space and enter.')}
                          onChange={() => {
                            dispatch({ type: 'CONFIG_FORM_UPDATE', key: 'checker_type', value: checkerType === 'strict' ? 'default' : 'strict' });
                          }}
                        />
                      </FormItem>
                    </div>
                  )}
                />
                <Tab
                  id="testlib"
                  title="testlib"
                  panel={(
                    <div className="row">
                      <FormItem columns={6} label="Type">
                        <select
                          value={category}
                          onChange={(ev) => {
                            setCategory(ev.currentTarget.value);
                            dispatch({ type: 'CONFIG_FORM_UPDATE', key: 'checker', value: null });
                          }}
                          className="select"
                        >
                          <option value="preset">{i18n('Preset')}</option>
                          <option value="custom">{i18n('Custom')}</option>
                        </select>
                      </FormItem>
                      {category === 'preset'
                        ? <FormItem columns={6} label="Checker">
                          <select
                            value={checker}
                            onChange={(ev) => dispatch({ type: 'CONFIG_FORM_UPDATE', key: 'checker', value: ev.currentTarget.value })}
                            className="select"
                          >
                            {testlibCheckers.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </FormItem>
                        : <FormItem columns={6} label="Checker">
                          <SingleFileSelect formKey="checker" />
                        </FormItem>}
                    </div>
                  )}
                />
                <Tab
                  id="other"
                  title="other"
                  panel={(
                    <div className="row">
                      <FormItem columns={6} label="Interface">
                        <ManagedSelect options={['syzoj', 'hustoj', 'qduoj', 'lemon']} formKey="checker_type" />
                      </FormItem>
                      <FormItem columns={6} label="Checker">
                        <SingleFileSelect formKey="checker" />
                      </FormItem>
                    </div>
                  )}
                />
              </Tabs>
            )}
          />
          <Tab
            id="interactive"
            title={i18n('problem_type.interactive')}
            panel={(
              <div className="row">
                <FormItem columns={6} label="Interactor">
                  <SingleFileSelect formKey="interactor" />
                </FormItem>
              </div>
            )}
          />
          <Tab
            id="submit_answer"
            title={i18n('problem_type.submit_answer')}
            panel={(
              <div className="row">
                <FormItem columns={6} label="Config" disableLabel>
                  <Switch
                    checked={subType === 'multi'}
                    label={i18n('Multi-file')}
                    onChange={() => {
                      dispatch({ type: 'CONFIG_FORM_UPDATE', key: 'subType', value: subType === 'multi' ? 'single' : 'multi' });
                    }}
                  />
                </FormItem>
                <FormItem columns={6} label="Filename">
                  <input
                    defaultValue={filename || '#.txt'}
                    placeholder="#.txt"
                    disabled={subType !== 'multi'}
                    onChange={(ev) => dispatch(({ type: 'CONFIG_FORM_UPDATE', key: 'filename', value: ev.currentTarget.value }))}
                    className="textbox"
                  />
                </FormItem>
              </div>
            )}
          />
          <Tab
            id="objective"
            title={i18n('problem_type.objective')}
            panel={(<p>{i18n('Unsupported configure this type of problem. Please refer to the documentation.')}</p>)}
          />
        </Tabs>
      </Card>
    </FormItem>
  );
}
