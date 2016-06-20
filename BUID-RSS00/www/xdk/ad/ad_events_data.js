/*jshint browser:true */
/*global $, intel, data_support, utils, console */

(function()
 {
    "use strict";

     if(!window.data_support)
     {
       window.data_support = {}; //namespace
     }

     /* ----------------
      data_event_handlers
      ---------------- */
     window.data_event_handlers = {
                                    on_init_proplist:{},
                                    on_data_proplist:{},      //<-- this is really more on_render
                                    on_click_proplist:{},
                                    tags:{"standard-list":{child:"li", parent:"ul"}}
                                  };


    window.data_event_handlers.on_click_proplist["standard-list"] = function(selector)
    {
        var safe_name = data_support.safe_name(selector);
        return function(entry){  $(document).trigger(safe_name+"_data", [entry]); };
    };


   /* ----------------
      safe_name
      ---------------- */
    data_support.safe_name = function(name)
    {
        return name.replace("#", "").replace(".", "").replace("-", "_").replace(":", "");
    };

   /* ----------------
      ready/late
      ---------------- */
   var ready_promises = [];
   var service_calls  = [];

   data_support.ready = function(f)
   {
     service_calls.push(f);

     var deferred = $.Deferred();
     ready_promises.push(deferred.promise());
     var call_f = function()
                  {
                      var res =  f();
                      if(res.then){ res.then(deferred.resolve).fail(deferred.reject); }
                      else{ deferred.resolve(true); }
                  };
     var delay_f = function()
                   {
                      if(data_support.delayed_ready){ data_support.delayed_ready(call_f); }
                      else{ call_f(); }
                   };
     document.addEventListener("app.Ready", delay_f, false) ;
     //$(document).ready(call_f);
   };

   data_support.late = function(f)
   {
      document.addEventListener("app.Ready", function()
      {
          $.when.apply(null, ready_promises).always(f);
      },
      false);
   };

    /* --------------
       refresh_all_services
      -------------- */
    data_support.refresh_all_services = function()
    {
        service_calls.forEach(function(f){ f(); });
    };


   /* ----------------
      case/switch dispatch
      ---------------- */

    if(!window.utils){ window.utils = {}; }

    var dispatch_table = {};
    function get_dispatch_obj(instance_name)
    {
      var dispatch_obj = dispatch_table[instance_name];
      if(!dispatch_obj) //set up a dispatch obj on the table if there isn't one already.
      {
        dispatch_obj = {}; //?
        dispatch_table[instance_name] = dispatch_obj;
      }
      return dispatch_obj;
    }

     /**
      dispatch_case
      @param {String} instance_name
      @param {*} case_identifier (usually a string)
      @param {Function} f

       Use the case_identifier of "default" to set a default action.
      */
    window.utils.dispatch_case = function(instance_name, case_identifier, f)
    {
      var dispatch_obj = get_dispatch_obj(instance_name);
      //add the case
      dispatch_obj[case_identifier] = f;
    };

     /**
     dispatch_switch
     @param {String} instance_name
     @param {*} case_identifier (usually a string) -- the case you want to select.
     @rest  args -- these args will be passed to the case function.

      note, if there is no match and no default case, this will throw an error.
     */
    window.utils.dispatch_switch = function()
    {
      var instance_name   = arguments[0];
      var case_identifier = arguments[1];
      var args            = Array.prototype.slice.call(arguments, 2);//arguments.slice(2); //
      var dispatch_obj    = get_dispatch_obj(instance_name);
      var f = dispatch_obj[case_identifier];
      if(!f){ f = dispatch_obj["default"]; }
      if(f)
      {
        return f.apply(null, args);
      }
      else
      {
        throw new Error("no matching case found for dispatch " + instance_name + "  " + case_identifier);
      }
    };


    /* ---------------
      data driving
      --------------- */
   var last_data = {};
   function driving_setup_on_change(domNode, data)
   {
     var f = $.debounce( 300, function(){ intel.xdk.services["call_" + data.service](); } );
     return utils.dispatch_switch("driving-on-change", data.uib, domNode, data, f);
   }

   function driving_setup(domNode, data)
   {
     return utils.dispatch_switch("driving-basic", data.uib, domNode, data);
   }

   function driving_get_value(domNode, data)
   {
     return utils.dispatch_switch("driving-get-value", data.uib, domNode, data);
   }

   //SETUP
   utils.dispatch_case("driving-on-change", "default",
                       function(domNode, data, f){ console.log("driving-on-change, uib not matched", data.uib, data, f); });

   utils.dispatch_case("driving-on-change", "standard-list",
                       function(domNode, data, f){ $(document).on(data.identifier, f); });
   utils.dispatch_case("driving-get-value", "default",
                       function(domNode, data, f){ console.log("driving-get-value, uib not matched", data.uib, data, f); });
   utils.dispatch_case("driving-get-value", "standard-list",
                       function(domNode, data)
                        {
                            return last_data[data.identifier][data.key];
                        });
   //setup basic
   utils.dispatch_case("driving-basic", "default",
                       function(domNode, data, f){ console.log("driving-basic, uib not matched", data.uib, data, f); });
   utils.dispatch_case("driving-basic", "standard-list",
                       function(domNode, data)
                       {
                         $(document).on(data.identifier, function(evt, val){  last_data[data.identifier] = val; });
                       });

    function dquote(str)
    {
       return str.replace(/'/g, "\"");
    }

   function push_unique(arr, entry, comparef)
    {
        var i;
        for(i=0; i < arr.length; i++)
        {
            if(comparef(arr[i], entry)){ return false; }
        }
        arr.push(entry);
        return true;
    }

   window.init_data_driving = function()
   {
      var $drivers = $("[data-driving]");
      var driven_services = {}; // {service_name_1: [{domNode: data:}...], ...}
      $drivers.each(function(index)
      {
        var domNode = this;
        var str = dquote($(domNode).data("driving"));
        try
        {
            var arr = JSON.parse(str);
            arr.forEach(function(data)
            {
                if(data.service)
                {
                    var modified = true;
                    if(driven_services[data.service])
                    {
                        modified = push_unique(driven_services[data.service], {domNode:domNode, data:data},
                                               function(old_entry, new_entry){ return (old_entry.data.field == new_entry.data.field); });
                    }
                    else
                    {
                        driven_services[data.service] = [{domNode:domNode, data:data}];
                    }
                    if(modified)
                    {
                        if(data.request_on_change)
                        {
                            driving_setup_on_change(domNode, data);
                        }
                        driving_setup(domNode, data);
                    }
                }
            });
        }
        catch(er){ console.log("parse failure", str, er, index); }
      });
      Object.keys(driven_services).forEach(function(service)
      {

          intel.xdk.services["call_" + service] = function()
                                                  {
                                                      var options = {};
                                                      driven_services[service].forEach(function(entry)
                                                      {
                                                          options[entry.data.field] = driving_get_value(entry.domNode, entry.data);
                                                      });
                                                      return intel.xdk.services[service](options);
                                                  };
      });
   };

 })();
