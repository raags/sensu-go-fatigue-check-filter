function fatigue_check(event, occurrences, interval, keepalive_occurrences, keepalive_interval, occurrences_window) {

    // my defaults
    var occurrences = occurrences || 1;               //  only the first occurrence
    var occurrences_window = occurrences_window || 0; //  disable occurrence time window
    var interval = interval || 1800;                  //  and every 30 minutes thereafter
    var allow_resolution = true;                      //  allow resolution events through
    var suppress_flapping = true;                     //  suppress when flapping

    // set keepalive defaults to match initially, if not provided
    var keepalive_occurrences = keepalive_occurrences || occurrences;
    var keepalive_interval = keepalive_interval || interval;

    // Use the above variable name with the check annotations fatigue_check/
    // (e.g. fatigue_check/occurrences) to override the defaults above

    function check_interval(event, occurrences, interval) {
      // The Math.ceil rounds up in the event that the interval requested is not
      // multiple of the check interval
      // Keeaplives
      if (event.check.occurrences > occurrences && (event.check.occurrences % (Math.ceil(interval / event.check.interval))) === 0) {
          return true;
      }

      return false;
    }

    function check_occurrences(event, occurrences, occurrences_window, interval) {

      // event is from an active check
      // TODO: find a better way to flag one off event v/s from an active check
      if (event.check.interval !== 1 || occurrences_window === 0) {
        if (event.check.occurrences === occurrences) {
          return true;
        }
        return check_interval(event, occurrences, interval)
      }

      // not part of an active check i.e. sent via api directly
      // occurrences_window is only valid with one off events
      //
      // check occurrence count within occurrences_window based on check history
      var history = event.check.history
      // disregard occurrences before this time
      var now_s = Math.floor(Date.now() / 1000)
      var occurrence_time_boundary = now_s - occurrences_window
      var past_occurrences = 0
      for (var i = history.length - 1; i >= 0; i--) {
          if (history[i].status > 0 && history[i].executed >= occurrence_time_boundary)  {
            past_occurrences += 1
          } else {
            break;
          }
      }
      if (past_occurrences === occurrences) {
        return true
      }
      // for irregular, one off events this might not work since interval might be large
      // Keeping the same as normal check for consistency
      return check_interval(event, occurrences, interval)
    }

    // MAIN
    // Check annotations first
    try {
        if (event.check.hasOwnProperty("annotations")) {
            if (event.check.annotations.hasOwnProperty("fatigue_check/occurrences")) {
                occurrences = parseInt(event.check.annotations["fatigue_check/occurrences"], 10);
            }
            if (event.check.annotations.hasOwnProperty("fatigue_check/occurrences_window")) {
                occurrences_window = parseInt(event.check.annotations["fatigue_check/occurrences_window"], 10);
            }
            if (event.check.annotations.hasOwnProperty("fatigue_check/interval")) {
                interval = parseInt(event.check.annotations["fatigue_check/interval"], 10);
            }
            if (event.check.annotations.hasOwnProperty("fatigue_check/allow_resolution")) {
                // anything other than explicitly false == true
                allow_resolution = !(/false/i).test(event.check.annotations["fatigue_check/allow_resolution"]);
            }
            if (event.check.annotations.hasOwnProperty("fatigue_check/suppress_flapping")) {
                // anything other than explicitly false == true
                suppress_flapping = !(/false/i).test(event.check.annotations["fatigue_check/suppress_flapping"]);
            }
        }
    }

    catch(err) {
        console.log("failed to get check annotations:");
        console.log(err.message);
        return false;
    }

    // Entity annotations second, to take precedence over check annotations
    // keepalive overrides only exist here
    try {
        if (event.entity.hasOwnProperty("annotations")) {
            if (event.entity.annotations.hasOwnProperty("fatigue_check/occurrences")) {
                occurrences = parseInt(event.entity.annotations["fatigue_check/occurrences"], 10);
            }
            if (event.entity.annotations.hasOwnProperty("fatigue_check/occurrences_window")) {
                occurrences_window = parseInt(event.entity.annotations["fatigue_check/occurrences_window"], 10);
            }
            if (event.entity.annotations.hasOwnProperty("fatigue_check/interval")) {
                interval = parseInt(event.entity.annotations["fatigue_check/interval"], 10);
            }
            if (event.entity.annotations.hasOwnProperty("fatigue_check/keepalive_occurrences")) {
                keepalive_occurrences = parseInt(event.entity.annotations["fatigue_check/keepalive_occurrences"], 10);
            }
            if (event.entity.annotations.hasOwnProperty("fatigue_check/keepalive_interval")) {
                keepalive_interval = parseInt(event.entity.annotations["fatigue_check/keepalive_interval"], 10);
            }
            if (event.entity.annotations.hasOwnProperty("fatigue_check/allow_resolution")) {
                // anything other than explicitly false == true
                allow_resolution = !(/false/i).test(event.entity.annotations["fatigue_check/allow_resolution"]);
            }
            if (event.entity.annotations.hasOwnProperty("fatigue_check/suppress_flapping")) {
                // anything other than explicitly false == true
                suppress_flapping = !(/false/i).test(event.entity.annotations["fatigue_check/suppress_flapping"]);
            }
        }
    }

    catch(err) {
        console.log("failed to get entity annotations:");
        console.log(err.message);
        return false;
    }

    if ((/flapping/i).test(event.check.state) && (/true/i).test(suppress_flapping)) {
        return false;
    }
    if (event.is_resolution && (/true/i).test(allow_resolution)) {
        // Check the event.occurrences_watermark to see if we would
        // have allowed the event into the pipeline. This is to prevent
        // resolution event into the pipeline if we've not previously allowed
        // through based on the desired occurrences
        if (event.check.occurrences_watermark >= occurrences) {
            return true;
        }
        else {
            return false;
        }
      // allow_resolution must be false, don't allow
    } else if (event.is_resolution) {
        return false;
    }

    if (event.check.name == 'keepalive') {
        // occurrences_window is always disabled for keepalive events
        return check_occurrences(event, keepalive_occurrences, 0, keepalive_interval)
    }

    if (event.check.name != 'keepalive') {
        return check_occurrences(event, occurrences, occurrences_window, interval)
    }

    return false;
}
