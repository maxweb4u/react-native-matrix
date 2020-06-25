/**
 * Created by Max Gor on 6/20/20
 *
 * This is help file that matrix-sdk-js works with react native
 */

import { EventEmitter } from 'fbemitter';
import unorm from 'unorm'

String.prototype.normalize = function(form) { return require('unorm')[String(form).toLowerCase()](this); }

class Document {
    constructor() {
        this.emitter = new EventEmitter();
        this.addEventListener = this.addEventListener.bind(this);
        this.removeEventListener = this.removeEventListener.bind(this);
        this._checkEmitter = this._checkEmitter.bind(this);
    }

    createElement(tagName) {
        return {};
    }

    _checkEmitter() {
        if (
            !this.emitter ||
            !(this.emitter.on || this.emitter.addEventListener || this.emitter.addListener)
        ) {
            this.emitter = new EventEmitter();
        }
    }

    addEventListener(eventName, listener) {
        this._checkEmitter();
        if (this.emitter.on) {
            this.emitter.on(eventName, listener);
        } else if (this.emitter.addEventListener) {
            this.emitter.addEventListener(eventName, listener);
        } else if (this.emitter.addListener) {
            this.emitter.addListener(eventName, listener);
        }
    }

    removeEventListener(eventName, listener) {
        this._checkEmitter();
        if (this.emitter.off) {
            this.emitter.off(eventName, listener);
        } else if (this.emitter.removeEventListener) {
            this.emitter.removeEventListener(eventName, listener);
        } else if (this.emitter.removeListener) {
            this.emitter.removeListener(eventName, listener);
        }
    }
}

window.document = window.document || new Document();