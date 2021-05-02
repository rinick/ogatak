"use strict";

const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const stringify = require("./stringify");
const {node_id_from_search_id} = require("./utils");

function new_engine() {

	let eng = Object.create(null);

	eng.exe = null;
	eng.filepath = "";
	eng.weights = "";

	eng.running = null;			// The search object actually running.
	eng.desired = null;			// The search object we want to be running - possibly the same object as above.

	eng.suppressed_search_id = null;

	Object.assign(eng, eng_props);
	return eng;
}

let eng_props = {

	__send: function(o) {
		if (!this.exe) {
			return;
		}
		if (typeof o !== "object") {
			throw "__send() requires an object";
		}
		try {
			let msg = JSON.stringify(o);
			this.exe.stdin.write(msg);
			this.exe.stdin.write("\n");
		} catch (err) {
			alert("While sending to engine:\n" + err.toString());
		}
	},

	analyse: function(node) {

		if (this.desired && node_id_from_search_id(this.desired.id) === node.id) {
			if (this.desired.komi === node.get_board().komi) {
				if (this.desired.rules === config.rules) {
					return;			// Because everything matches - the search desired is already set as such.
				}
			}
		}

		this.desired = node.katago_query();

		if (this.running) {
			this.__send({
				id: `stop!${this.running.id}`,
				action: "terminate",
				terminateId: `${this.running.id}`
			});
		} else {
			this.__send(this.desired);
			this.running = this.desired;
		}
	},

	suppress: function() {

		// Further updates from this search get their id altered so as not to be recognised by the hub as belonging to its node.
		// They still get passed on, since the hub uses incoming messages as a trigger to redraw the status.

		if (this.running) {
			this.suppressed_search_id = this.running.id;
		}
	},

	halt: function() {				// Only for user-caused halts, as it sets desired to null.
		if (this.running) {
			this.__send({
				id: `stop!${this.running.id}`,
				action: "terminate",
				terminateId: `${this.running.id}`
			});
		}
		this.desired = null;
	},

	setup: function(filepath, engineconfig, weights) {

		if (!fs.existsSync(filepath) || !fs.existsSync(engineconfig) || !fs.existsSync(weights)) {
			return;
		}

		try {
			this.exe = child_process.spawn(filepath, ["analysis", "-config", engineconfig, "-model", weights], {cwd: path.dirname(filepath)});
		} catch (err) {
			alert("engine.setup() failed:\n" + err.toString());
			return false;
		}

		this.filepath = filepath;
		this.weights = weights;

		this.scanner = readline.createInterface({
			input: this.exe.stdout,
			output: undefined,
			terminal: false
		});

		this.err_scanner = readline.createInterface({
			input: this.exe.stderr,
			output: undefined,
			terminal: false
		});

		this.scanner.on("line", (line) => {
			let o = JSON.parse(line);
			if (o.error || o.warning) {
				alert("Engine said:\n" + stringify(o));
			}
			if (o.isDuringSearch === false) {
				if (this.running && this.running.id === o.id) {
					this.running = null;
					if (this.desired) {
						this.__send(this.desired);
						this.running = this.desired;
					}
				}
			}
			if (typeof o.id === "string" && o.id === this.suppressed_search_id) {
				o.id = "suppressed!" + o.id;
			}
			hub.receive_object(o);
		});

		this.err_scanner.on("line", (line) => {
			console.log("! " + line);
		});

	},

};



module.exports = new_engine;
