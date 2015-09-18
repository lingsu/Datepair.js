# Datepair.js

[See a demo and examples here](http://jonthornton.github.com/Datepair.js)

增加午休时间，不会计算午休占用的时间
排除周末时间


## Requirements

* [jquery-timepicker](https://github.com/jonthornton/jquery-timepicker) (>= 1.3) (this dependency can be overridden)
* [Bootstrap Datepicker](https://github.com/eternicode/bootstrap-datepicker) (>= 1.3) (this dependency can be overridden)

## Usage

Include `dist/datepair.js`  in your app.

```javascript

var datepair = new Datepair($('#container'), datepairOption)
```