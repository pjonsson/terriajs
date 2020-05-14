import createReactClass from "create-react-class";
import PropTypes from "prop-types";
import React from "react";
import defined from "terriajs-cesium/Source/Core/defined";
import TerriaError from "../../Core/TerriaError";
import parseCustomMarkdownToReact from "../Custom/parseCustomMarkdownToReact";
import Loader from "../Loader";
import ParameterEditor from "./ParameterEditor";
import Styles from "./invoke-function.scss";
import { withTranslation } from "react-i18next";
import { observer } from "mobx-react";
import { runInAction, observable } from "mobx";

class FunctionViewModel {
  constructor(catalogFunction) {
    this.catalogFunction = catalogFunction;
    this._parameters = {};
  }

  getParameter(parameter) {
    let result = this._parameters[parameter.id];
    if (!result || result.parameter !== parameter) {
      result = this._parameters[parameter.id] = new ParameterViewModel(
        parameter
      );
    }
    return result;
  }
}

class ParameterViewModel {
  parameter;

  @observable
  userValue = undefined;
  @observable
  isValueValid = true;
  @observable
  wasEverBlurredWhileInvalid = false;

  constructor(parameter) {
    this.parameter = parameter;
  }
}

const InvokeFunction = observer(
  createReactClass({
    displayName: "InvokeFunction",

    propTypes: {
      terria: PropTypes.object,
      previewed: PropTypes.object,
      viewState: PropTypes.object,
      t: PropTypes.func.isRequired
    },

    /* eslint-disable-next-line camelcase */
    UNSAFE_componentWillMount() {
      this.parametersViewModel = new FunctionViewModel(this.props.previewed);
    },

    /* eslint-disable-next-line camelcase */
    UNSAFE_componentWillUpdate(nextProps, nextState) {
      if (nextProps.previewed !== this.parametersViewModel.catalogFunction) {
        // Clear previous parameters view model, because this is a different catalog function.
        this.parametersViewModel = new FunctionViewModel(nextProps.previewed);
      }
    },

    submit() {
      try {
        const promise = this.props.previewed.invoke().catch(terriaError => {
          if (terriaError instanceof TerriaError) {
            this.props.previewed.terria.error.raiseEvent(terriaError);
          }
        });

        runInAction(() => {
          // Close modal window
          this.props.viewState.explorerPanelIsVisible = false;
          // mobile switch to nowvewing
          this.props.viewState.switchMobileView(
            this.props.viewState.mobileViewOptions.preview
          );
        });

        return promise;
      } catch (e) {
        if (e instanceof TerriaError) {
          this.props.previewed.terria.error.raiseEvent(e);
        }
        return undefined;
      }
    },

    getParams() {
      // Key should include the previewed item identifier so that
      // components are refreshed when different previewed items are
      // displayed
      return this.props.previewed.functionParameters.map((param, i) => (
        <ParameterEditor
          key={param.id + this.props.previewed.uniqueId}
          parameter={param}
          viewState={this.props.viewState}
          previewed={this.props.previewed}
          parameterViewModel={this.parametersViewModel.getParameter(param)}
        />
      ));
    },

    validateParameter(parameter) {
      if (!this.parametersViewModel.getParameter(parameter).isValueValid) {
        // Editor says it's not valid, so it's not valid.
        return false;
      }

      // Verify that required parameters have a value.
      if (parameter.isRequired && !defined(parameter.value)) {
        return false;
      }

      return true;
    },

    render() {
      if (this.props.previewed.isLoading) {
        return <Loader />;
      }

      let invalidParameters = false;
      if (defined(this.props.previewed.parameters)) {
        invalidParameters = !this.props.previewed.functionParameters.every(
          this.validateParameter
        );
      }
      const { t } = this.props;
      return (
        <div className={Styles.invokeFunction}>
          <div className={Styles.content}>
            <h3>{this.props.previewed.name}</h3>
            <div className={Styles.description}>
              {parseCustomMarkdownToReact(this.props.previewed.description, {
                catalogItem: this.props.previewed
              })}
            </div>
            {this.getParams()}
          </div>
          <div className={Styles.footer}>
            <button
              type="button"
              className={Styles.btn}
              onClick={this.submit}
              disabled={invalidParameters}
            >
              {t("analytics.runAnalysis")}
            </button>
          </div>
        </div>
      );
    }
  })
);

module.exports = withTranslation()(InvokeFunction);
