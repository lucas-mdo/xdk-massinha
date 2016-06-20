var data_views   = { group:[], single:[], bindings:{}};
















data_views.group.push({"model":{"title":null,"link._href":null,"group.title.__text":null,"group.thumbnail._url":null},"child":"#btlist","parent":".uib_col_1"});
/* prepare controllers */

data_support.prepare_mvc("#btlist", "intel.xdk.services.uarss", ["feed","entry"], "standard-list", data_views);
