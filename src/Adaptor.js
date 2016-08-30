import { execute as commonExecute, expandReferences } from 'language-common';
import { getThenPost, clientPost } from './Client';
import request from 'request'
import { resolve as resolveUrl } from 'url';

/** @module Adaptor */

/**
 * Execute a sequence of operations.
 * Wraps `language-common/execute`, and prepends initial state for http.
 * @example
 * execute(
 *   create('foo'),
 *   delete('bar')
 * )(state)
 * @constructor
 * @param {Operations} operations - Operations to be performed.
 * @returns {Operation}
 */
export function execute(...operations) {
  const initialState = {
    references: [],
    data: null
  }

  return state => {
    return commonExecute(...operations)({ ...initialState, ...state })
  };

}

/**
 * Make a GET request and POST it somewhere else
 * @example
 * execute(
 *   fetch(params)
 * )(state)
 * @constructor
 * @param {object} params - data to make the fetch
 * @returns {Operation}
 */
export function fetchSubmissions(formId, afterDate, postUrl) {

  // GET IT BACK INTO STATE!
  //   function(state) {
  //       return { "date": dataValue("_json[(@.length-1)].SubmissionDate")(state) }
  //   }

  return state => {

    const { afterDate } = expandReferences(afterDate)(state);

    const { username, password, instanceName } = state.configuration;

    const baseUrl = "https://".concat(instanceName, ".surveycto.com/api/v1/forms/data/wide/json")

    const url = resolveUrl(baseUrl + '/', formId)

    console.log("Fetching submissions from URL: " + url);
    console.log("After: " + afterDate)

    return getThenPost({
      username, password, query, url, sendImmediately, postUrl
    }).then((response) => {
      console.log("Success:", response);
      var submissions = response.body;
      if (submissions.length) {
        state.lastSubmissionDate = submissions[submissions.length-1].SubmissionDate
      }
      return state
    })

  }
}

/**
 * Make a POST request
 * @example
 * execute(
 *   post(params)
 * )(state)
 * @constructor
 * @param {object} params - data to make the POST
 * @returns {Operation}
 */
export function post(url, {body, callback}) {

  return state => {

    return new Promise((resolve, reject) => {
      request.post ({
        url: url,
        json: body
      }, function(error, response, body){
        if(error) {
          reject(error);
        } else {
          console.log("POST succeeded.");
          resolve(body);
        }
      })
    }).then((data) => {
      const nextState = { ...state, response: { body: data } };
      if (callback) return callback(nextState);
      return nextState;
    })

  }
}

/**
 * Make a GET request
 * @example
 * execute(
 *   get("my/endpoint", {
 *     callback: function(data, state) {
 *       return state;
 *     }
 *   })
 * )(state)
 * @constructor
 * @param {string} url - Path to resource
 * @param {object} params - callback and query parameters
 * @returns {Operation}
 */
export function get(path, {query, callback}) {
  function assembleError({ response, error }) {
    if ([200,201,202].indexOf(response.statusCode) > -1) return false;
    if (error) return error;

    return new Error(`Server responded with ${response.statusCode}`)
  }

  return state => {

    const { username, password, baseUrl, authType } = state.configuration;
    const { query: qs } = expandReferences({query})(state);

    const sendImmediately = (authType != 'digest');

    const url = resolveUrl(baseUrl + '/', path)

    return new Promise((resolve, reject) => {

      request({
        url,      //URL to hit
        qs,     //Query string data
        method: 'GET', //Specify the method
        auth: {
          'user': username,
          'pass': password,
          'sendImmediately': sendImmediately
        }
      }, function(error, response, body){
        error = assembleError({error, response})
        if (error) {
          reject(error);
        } else {
          resolve(JSON.parse(body))
        }
      });

    }).then((data) => {
      const nextState = { ...state, response: { body: data } };
      if (callback) return callback(nextState);
      return nextState;
    })
  }
}

export {
  field, fields, sourceValue, fields, alterState,
  merge, dataPath, dataValue, lastReferenceValue
} from 'language-common';
