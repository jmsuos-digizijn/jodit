import Jodit from "../Jodit"
import {Config} from '../Config'
import {each, extend} from "./Helpers";
import PseudoPromise from "./PseudoPromise";
import Component from "./Component";

/**
 * @property {object} defaultAjaxOptions A set of key/value pairs that configure the Ajax request. All settings are optional
 * @memberof module:Dom
 * @property {object} defaultAjaxOptions.headers An object of additional header key/value pairs to send along with requests using the XMLHttpRequest transport. Uses in {@link module:FileBrowser|FileBrowser} and {@link module:Uploader|Uploader}
 * @property {string} defaultAjaxOptions.dataType='json' json or text The type of data that you're expecting back from the server. if `json` the return value passes through the `JSON.parse`
 * @property {string} defaultAjaxOptions.method='GET' The HTTP method to use for the request (e.g. "POST", "GET", "PUT")
 * @property {string} defaultAjaxOptions.url='' A string containing the URL to which the request is sent.
 * @property {string} defaultAjaxOptions.async=true By default, all requests are sent asynchronously (i.e. this is set to true by default). If you need synchronous requests, set this option to false
 * @property {object|string} defaultAjaxOptions.data=null Data to be sent to the server. It is converted to a query string, if not already a string. It's appended to the url for GET-requests.
 * @property {string} defaultAjaxOptions.contentType='application/x-www-form-urlencoded; charset=UTF-8' When sending data to the server, use this content type. Default is "application/x-www-form-urlencoded; charset=UTF-8", which is fine for most cases
 * @property {function} defaultAjaxOptions.error=function () {} A function to be called if the request fails
 * @property {function} defaultAjaxOptions.success=function (resp) {} A function to be called if the request succeeds
 * @property {function} defaultAjaxOptions.xhr=function () { return new XMLHttpRequest(); } Callback for creating the XMLHttpRequest object.
 * @memberof Jodit.defaultOptions
 */

declare let XDomainRequest: any;

interface IAjaxOptions {
    dataType: string;
    method: string;

    url: string;

    async: boolean;

    data: {[key: string]: string}|null

    contentType: string;

    headers: {[key: string]: string}

    withCredentials: boolean;

    xhr: () => XMLHttpRequest;
}

declare module "../Config" {
    interface Config {
        defaultAjaxOptions: IAjaxOptions;
    }
}

Config.prototype.defaultAjaxOptions = {
    dataType: 'json',
    method: 'GET',

    url: '',

    async: true,

    data: null,

    contentType: 'application/x-www-form-urlencoded; charset=UTF-8',

    headers: {
        'X-REQUESTED-WITH': 'XMLHttpRequest' // compatible with jQuery
    },

    withCredentials: true,

    xhr: () => {
        const XHR = typeof XDomainRequest === 'undefined' ? XMLHttpRequest : XDomainRequest;
        return new XHR();
    }
};

export default class Ajax extends Component{
    private __buildParams (obj, prefix?: string) {
        if (typeof obj === 'string' || (window['FormData'] && obj instanceof window['FormData'])) {
            return obj;
        }
        let str = [], p, k, v;
        for (p in obj) {
            if (obj.hasOwnProperty(p)) {
                k = prefix ? prefix + "[" + p + "]" : p;
                v = obj[p];
                str.push(typeof v === "object" ? this.__buildParams(v, k) : encodeURIComponent(k) + "=" + encodeURIComponent(v));
            }
        }
        return str.join("&");
    }

    private xhr: XMLHttpRequest;

    status: number;
    response: string;

    abort () {
        this.xhr.abort();
        return this;
    }

    options: IAjaxOptions;

    constructor(editor: Jodit, options?: any) {
        super(editor);
        this.options = extend(true, {}, Config.prototype.defaultAjaxOptions, options);
        this.xhr = this.options.xhr();
    }

    send(): PseudoPromise {
        return new PseudoPromise((resolve, reject) => {
            const __parse = (resp: string) => {
                switch (this.options.dataType) {
                    case 'json':
                        try {
                            resp = JSON.parse(resp);
                        } catch (e) {
                            reject.call(this.xhr, e);
                            return;
                        }
                        break;
                }
                return resp;
            };

            this.xhr.onabort = reject;
            this.xhr.onerror = reject;
            this.xhr.ontimeout = reject;
            this.xhr.onload = () => {
                this.response = this.xhr.responseText;
                this.status = this.xhr.status;
                resolve.call(this.xhr, __parse(this.response));
            };

            this.xhr.onreadystatechange = () => {
                if (this.xhr.readyState === XMLHttpRequest.DONE) {
                    let resp = this.xhr.responseText;

                    this.response = resp;
                    this.status = this.xhr.status;

                    if (this.xhr.status === 200) {
                        resolve.call(this.xhr, __parse(resp));
                    } else {
                        reject.call(this.xhr, new Error(this.xhr.statusText || this.parent.i18n('Connection error!')));
                    }
                }
            };

            this.xhr.withCredentials = this.options.withCredentials;

            this.xhr.open(this.options.method, this.options.url, this.options.async);

            if (this.options.contentType && this.xhr.setRequestHeader) {
                this.xhr.setRequestHeader("Content-type", this.options.contentType);
            }

            if (this.options.headers && this.xhr.setRequestHeader) {
                each(this.options.headers, (key, value) => {
                    this.xhr.setRequestHeader(key, value);
                });
            }

            //IE
            setTimeout(() => {
                this.xhr.send(this.options.data ? this.__buildParams(this.options.data) : undefined);
            }, 0);
        });
    }
}