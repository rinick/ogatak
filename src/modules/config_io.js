"use strict";

// Remember this will run twice in 2 different processes, so don't autosave etc.

const electron = require("electron");
const fs = require("fs");
const path = require("path");
const querystring = require("querystring");

exports.filename = "config.json";

// To avoid using "remote", we rely on the main process passing userData location in the query...

exports.filepath = electron.app ?
		path.join(electron.app.getPath("userData"), exports.filename) :									// in Main process
		path.join(querystring.parse(global.location.search)["?user_data_path"], exports.filename);		// in Renderer process

// ---------------------------------------------------------------------------------------------------------------------------

exports.config = {};

exports.defaults = {

	"arbitrary_command": "",				// Must be edited by the user in config.json
	"arbitrary_argslist": [],				// Likewise.

	"engine": "",
	"engineconfig": "",
	"weights": "",

	"board_line_width": 1,

	"square_size": 36,

	"info_font_size": 16,

	"board_font_size": 14,
	"top_colour_black": "#77ddddff",
	"top_colour_white": "#77ddddff",
	"off_colour_black": "#99dd55ff",
	"off_colour_white": "#99dd55ff",
	"wood_colour": "#d2b074ff",
	"previous_marker": "#888888ff",
	"next_marker_linewidth": 2.8,
	"candidate_moves": true,
	"numbers": "LCB + Visits",
	"visits_threshold": 0.02,
	"mouseover_pv": true,
	"next_move_markers": true,
	"visit_colours": true,

	"thumbnail_square_size": 4,

	"graph_type": "Winrate",
	"minor_graph_linewidth": 1,
	"major_graph_linewidth": 2,
	"minor_graph_colour": "#444444ff",
	"major_graph_colour": "#4ba28bff",
	"major_graph_var_colour": "#4b8ba2ff",
	"midline_graph_colour": "#222222ff",
	"graph_width": 224,

	"tree_spacing": 24,
	"tree_off_colour": "#444444ff",
	"tree_main_colour": "#909090ff",
	"central_node_colour": "#d2b074ff",

	"widerootnoise": true,
	"symmetry_pruning": true,
	"report_every": 0.1,

	"dead_stone_prediction": true,
	"dead_stone_per_move": true,

	"logfile": null,
	"width": 1200,
	"height": 780,
	"auto_square_size": true,
	"stderr_to_console": true,
	"load_at_end": true,
	"tree_draw_delay": 17,					// Note that the tree draw will be skipped if not needed.
	"graph_draw_delay": 200,				// The graph draw, however, is never skipped.
	"input_delay": 0,
	"autoanalysis_visits": 500,
	"default_rules": "Chinese",				// Used for game on startup, as well as when rules are "Unknown".
	"default_komi": 7.5,					// Used for game on startup, but otherwise unknown komi is inferred as zero.

	"sgf_folder": "",
	"katago_folder": "",
	"kataconfig_folder": "",
	"weights_folder": "",
};

// ---------------------------------------------------------------------------------------------------------------------------

let errortext = "";

exports.error = () => {
	return errortext;
};

// ---------------------------------------------------------------------------------------------------------------------------

exports.load = () => {

	try {
		if (fs.existsSync(exports.filepath)) {
			Object.assign(exports.config, JSON.parse(fs.readFileSync(exports.filepath, "UTF-8")));
		}
		errortext = "";
	} catch (err) {
		console.log(err.toString());
		errortext = err.toString();
	}

	// Copy default values for any missing keys into the config...
	// We use a copy so that any objects that are assigned are not the default objects.

	let defaults_copy = JSON.parse(JSON.stringify(exports.defaults));

	for (let key of Object.keys(defaults_copy)) {
		if (exports.config.hasOwnProperty(key) === false) {
			exports.config[key] = defaults_copy[key];
		}
	}
};

// ---------------------------------------------------------------------------------------------------------------------------

exports.save = () => {

	// Don't save if the load failed. Let the user fix their
	// broken config file, don't overwrite it with a fresh one.

	if (errortext) {
		return;
	}

	// Make a copy of the defaults. Doing it this way seems to
	// ensure the final JSON string has the same ordering...

	let out = JSON.parse(JSON.stringify(exports.defaults));

	// Adjust that copy, but only for keys present in both.

	for (let key of Object.keys(exports.config)) {
		if (out.hasOwnProperty(key)) {
			out[key] = exports.config[key];
		}
	}

	try {
		fs.writeFileSync(exports.filepath, JSON.stringify(out, null, "\t"));
	} catch (err) {
		console.log(err.toString());
	}
};

// ---------------------------------------------------------------------------------------------------------------------------

exports.create_if_needed = () => {

	if (fs.existsSync(exports.filepath)) {
		return;
	}

	exports.save();
};
