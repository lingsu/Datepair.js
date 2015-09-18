(function (window, document) {

    'use strict';

    var _DAY = 86400000;
    var _ONE_DAY = 27000000;
    var jq = window.jQuery;

    function simpleExtend(obj1, obj2) {
        var out = obj2 || {};

        for (var i in obj1) {
            if (!(i in out)) {
                out[i] = obj1[i];
            }
        }

        return out;
    }

    // IE's custom event support is totally borked.
    // Use jQuery if possible
    function triggerSimpleCustomEvent(el, eventName) {
        if (jq) {
            jq(el).trigger(eventName);
        } else {
            var event = document.createEvent('CustomEvent');
            event.initCustomEvent(eventName, true, true, {});
            el.dispatchEvent(event);
        }
    }

    // el.classList not supported by < IE10
    // use jQuery if available
    function hasClass(el, className) {
        return el.hasClass(className);
    }

    function Datepair(container, options) {
        var self = this;
        this.dateDelta = null;
        this.timeDelta = null;
        this._defaults = {
            startClass: 'start',
            endClass: 'end',
            timeClass: 'time',
            dateClass: 'date',
            defaultDateDelta: 0,
            defaultTimeDelta: 0,
            anchor: 'start',
            disableTimeRanges: [['11:30', '13:20']],

            // defaults for jquery-timepicker; override when using other input widgets
            parseTime: function (input) {
                return input.timepicker('getTime');
            },
            updateTime: function (input, dateObj) {
                input.timepicker('setTime', dateObj);
            },
            setMinTime: function (input, dateObj) {
                input.timepicker('option', 'minTime', dateObj);
            },
            getMinTime: function (input) {
                return '8:30';
            },
            // defaults for bootstrap datepicker; override when using other input widgets
            parseDate: function (input) {
                return input.val() && input.datepicker('getDate');
            },
            updateDate: function (input, dateObj) {
                input.datepicker('update', dateObj);
            }
        };

        this.container = container;
        this.settings = simpleExtend(this._defaults, options);

        this.startDateInput = this.container.find('.' + this.settings.startClass + '.' + this.settings.dateClass);
        this.endDateInput = this.container.find('.' + this.settings.endClass + '.' + this.settings.dateClass);
        this.startTimeInput = this.container.find('.' + this.settings.startClass + '.' + this.settings.timeClass);
        this.endTimeInput = this.container.find('.' + this.settings.endClass + '.' + this.settings.timeClass);

        if (this._defaults.disableTimeRanges.length > 0) {
            for (var i in this._defaults.disableTimeRanges) {
                this._defaults.disableTimeRanges[i] = [
					this._time2int(this._defaults.disableTimeRanges[i][0]),
					this._time2int(this._defaults.disableTimeRanges[i][1])
                ];
            }
            // sort by starting time
            this._defaults.disableTimeRanges = this._defaults.disableTimeRanges.sort(function (a, b) {
                return a[0] - b[0];
            });
        }
        // initialize date and time deltas
        this.refresh();
        this._updateEndMintime();

        //// init starts here
        this._bindChangeHandler();
    }

    Datepair.prototype = {
        constructor: Datepair,

        option: function (key, value) {
            if (typeof key == 'object') {
                this.settings = simpleExtend(this.settings, key);

            } else if (typeof key == 'string' && typeof value != 'undefined') {
                this.settings[key] = value;

            } else if (typeof key == 'string') {
                return this.settings[key];
            }

            this._updateEndMintime();
        },

        getTimeDiff: function () {
            // due to the fact that times can wrap around, timeDiff for any
            // time-only pair will always be >= 0
            var delta = this.dateDelta + this.timeDelta;

            if (this.dateDelta > _ONE_DAY) {
                var days = this.dateDelta / _ONE_DAY;
                var startDate = new Date(this.startDateInput.val());
                var l = startDate.getDay();
                var cnt = parseInt(days / 7);
                var yushu = days % 7;
                if (yushu + l > 7) {
                    cnt++;
                }
                delta -= cnt * _ONE_DAY;
            }

            if (!(!this.startDateInput.val() && !this.endDateInput.val()) && (!this.startTimeInput.val() || !this.endTimeInput.val())) {
                delta += _ONE_DAY;
            }

            //console.log('getTimeDiff: %d ,dateDelta:%d ,timeDelta:%d', delta, this.dateDelta, this.timeDelta);
            return delta;
        },

        refresh: function () {
            if (this.startDateInput.val() && this.endDateInput.val()) {
                var startDate = this.settings.parseDate(this.startDateInput);
                var endDate = this.settings.parseDate(this.endDateInput);
                if (startDate && endDate) {
                    this.dateDelta = endDate.getTime() - startDate.getTime();
                }
            }
            if (this.startTimeInput.val() && this.endTimeInput.val()) {
                var startTime = this.settings.parseTime(this.startTimeInput);
                var endTime = this.settings.parseTime(this.endTimeInput);
                if (startTime && endTime) {
                    this.timeDelta = endTime.getTime() - startTime.getTime();
                }
            }
        },

        remove: function () {
            this._unbindChangeHandler()
        },

        _bindChangeHandler: function () {
            // addEventListener doesn't work with synthetic "change" events
            // fired by jQuery's trigger() functioin. If jQuery is present,
            // use that for event binding
            //if (jq) {
            this.container.on('change.datepair', jq.proxy(this.handleEvent, this));
            //} else {
            //    this.container.addEventListener('change', this, false);
            //}
        },

        _unbindChangeHandler: function () {
            //if (jq) {
            this.container.off('change.datepair');
            //} else {
            //    this.container.removeEventListener('change', this, false);
            //}
        },

        // This function will be called when passing 'this' to addEventListener
        handleEvent: function (e) {
            // temporarily unbind the change handler to prevent triggering this
            // if we update other inputs
            this._unbindChangeHandler();
            var elc = $(e.target);
            if (hasClass(elc, this.settings.dateClass)) {
                if (elc.val() != '') {
                    this._dateChanged(elc);
                } else {
                    this.dateDelta = null;
                }

            } else if (hasClass(elc, this.settings.timeClass)) {
                if (elc.val() != '') {
                    this._timeChanged(elc);
                } else {
                    this.timeDelta = null;
                }
            }

            this._validateRanges();
            this._updateEndMintime()
            this._bindChangeHandler();
            triggerSimpleCustomEvent(this.container, 'complete');
            return;
        },

        _dateChanged: function (target) {
            if (!this.startDateInput || !this.endDateInput) {
                return
            }

            var startDate = this.settings.parseDate(this.startDateInput);
            var endDate = this.settings.parseDate(this.endDateInput);

            if (!startDate || !endDate) {
                if (this.settings.defaultDateDelta !== null) {
                    if (startDate) {
                        var newEnd = new Date(startDate.getTime() + this.settings.defaultDateDelta * _ONE_DAY);
                        this.settings.updateDate(this.endDateInput, newEnd);

                    } else if (endDate) {
                        var newStart = new Date(endDate.getTime() - this.settings.defaultDateDelta * _ONE_DAY);
                        this.settings.updateDate(this.startDateInput, newStart);
                    }

                    this.dateDelta = this.settings.defaultDateDelta * _ONE_DAY;
                } else {
                    this.dateDelta = null;
                }

                return;
            }

            if (this.settings.anchor == 'start' && hasClass(target, this.settings.startClass)) {
                var newDate = new Date(startDate.getTime() + (this.dateDelta / _ONE_DAY) * _DAY);
                this.settings.updateDate(this.endDateInput, newDate);
            } else if (this.settings.anchor == 'end' && hasClass(target, this.settings.endClass)) {
                var newDate = new Date(endDate.getTime() - (this.dateDelta / _ONE_DAY) * _DAY);
                this.settings.updateDate(this.startDateInput, newDate);
            } else {
                if (endDate < startDate) {
                    var otherInput = hasClass(target, this.settings.startClass) ? this.endDateInput : this.startDateInput;
                    var selectedDate = this.settings.parseDate(target);
                    this.dateDelta = 0;
                    this.settings.updateDate(otherInput, selectedDate);
                } else {
                    var days = (endDate.getTime() - startDate.getTime()) / _DAY;
                    this.dateDelta = days * _ONE_DAY;
                }
            }
        },

        _timeChanged: function (target) {

            if (!this.startTimeInput || !this.endTimeInput) {
                return;
            }

            var startTime = this.settings.parseTime(this.startTimeInput);
            var endTime = this.settings.parseTime(this.endTimeInput);

            if (!startTime || !endTime) {
                if (this.settings.defaultTimeDelta !== null) {
                    if (startTime) {
                        var newEnd = new Date(startTime.getTime() + this.settings.defaultTimeDelta);
                        this.settings.updateTime(this.endTimeInput, newEnd);
                    } else if (endTime) {
                        var newStart = new Date(endTime.getTime() - this.settings.defaultTimeDelta);
                        this.settings.updateTime(this.startTimeInput, newStart);
                    }

                    this.timeDelta = this.settings.defaultTimeDelta;
                } else {
                    this.timeDelta = null;
                }

                return;
            }

            if (this.settings.anchor == 'start' && hasClass(target, this.settings.startClass)) {
                var newTime = new Date(startTime.getTime());
                if ((!this.dateDelta || this.dateDelta === 0) && startTime > endTime)
                    this.settings.updateTime(this.endTimeInput, newTime);
                endTime = this.settings.parseTime(this.endTimeInput);
            } else if (this.settings.anchor == 'end' && hasClass(target, this.settings.endClass)) {
                var newTime = new Date(endTime.getTime());
                this.settings.updateTime(this.startTimeInput, newTime);
                startTime = this.settings.parseTime(this.startTimeInput);
            }

            var newDelta = endTime.getTime() - startTime.getTime();

            var dr = this.settings.disableTimeRanges;
            var drLen = dr.length;
            if (drLen > 0) {
                var start = this._time2int(startTime);
                var end = this._time2int(endTime);

                for (var i = 0; i < drLen; i++) {
                    if (start <= dr[i][0] && end >= dr[i][1]) {
                        newDelta -= (dr[i][1] - dr[i][0]) * 1000;

                    } else if (start > end && end <= dr[i][0] && start >= dr[i][1]) {
                        newDelta += (dr[i][1] - dr[i][0]) * 1000;
                    }
                }
            }

            this.timeDelta = newDelta;
        },

        _updateEndMintime: function () {
            if (typeof this.settings.setMinTime != 'function') return;

            var baseTime = null;
            if (this.settings.anchor == 'start' && (!this.dateDelta || this.dateDelta < _ONE_DAY || (this.timeDelta && this.dateDelta + this.timeDelta < _ONE_DAY))) {
                baseTime = this.settings.parseTime(this.startTimeInput);
            } else {
                baseTime = this.settings.getMinTime(this.endTimeInput);
            }

            this.settings.setMinTime(this.endTimeInput, baseTime);
        },

        _validateRanges: function () {
            if (this.startTimeInput && this.endTimeInput && this.timeDelta === null) {
                triggerSimpleCustomEvent(this.container, 'rangeIncomplete');
                return;
            }

            if (this.startDateInput && this.endDateInput && this.dateDelta === null) {
                triggerSimpleCustomEvent(this.container, 'rangeIncomplete');
                return;
            }

            // due to the fact that times can wrap around, any time-only pair will be considered valid
            if (!this.startDateInput || !this.endDateInput || this.dateDelta + this.timeDelta >= 0) {
                triggerSimpleCustomEvent(this.container, 'rangeSelected');
            } else {
                triggerSimpleCustomEvent(this.container, 'rangeError');
            }
        },
        _updateShow: function () {

        },
        _time2int: function (timeString) {

            if (typeof (timeString) == 'object') {
                return timeString.getHours() * 3600 + timeString.getMinutes() * 60 + timeString.getSeconds();
            }

            var pattern = new RegExp('^([0-2]?[0-9])\\W?([0-5][0-9])?\\W?([0-5][0-9])?$');

            var time = timeString.match(pattern);
            if (!time) {
                return null;
            }
            var hour = parseInt(time[1] * 1, 10);
            var hours = hour;
            var minutes = (time[2] * 1 || 0);
            var seconds = (time[3] * 1 || 0);
            var timeInt = hours * 3600 + minutes * 60 + seconds;
            return timeInt;
        }
    }

    window.Datepair = Datepair;

}(window, document));