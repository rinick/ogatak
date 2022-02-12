"use strict";

// FIXME - remember to fix config.numbers if it's bad in the config.

// Background graphic is set as the TABLE background.
// TD elements contain nothing, black stone, white stone, or ko marker.
// Everything else is drawn to a CANVAS above that.

const background = require("./background");
const {moveinfo_filter, node_id_from_search_id, pad, opposite_colour, new_2d_array, xy_to_s, float_to_hex_ff} = require("./utils");

const black_stone = new Image();	black_stone.src = "./gfx/black_stone.png";		const black_stone_url = `url("${black_stone.src}")`;
const white_stone = new Image();	white_stone.src = "./gfx/white_stone.png";		const white_stone_url = `url("${white_stone.src}")`;
const   ko_marker = new Image();	  ko_marker.src =          "./gfx/ko.png";		const   ko_marker_url = `url("${ko_marker.src}")`;

let mouseenter_handlers = new_2d_array(25, 25, null);

for (let x = 0; x < 25; x++) {				// Create the event handlers for all usable values of x,y...
	for (let y = 0; y < 25; y++) {			// These will be attached to TD elements, firing on "mouseenter" events.
		let s = xy_to_s(x, y);
		mouseenter_handlers[x][y] = () => {
			hub.mouse_entering_point(s);
		};
	}
}

function new_board_drawer(backgrounddiv, htmltable, canvas, infodiv) {

	// Only one of these is ever created. We could dispense with having this object at all, and
	// just have functions in this module (instead of methods in the object) but meh.

	let drawer = Object.create(board_drawer_prototype);

	drawer.backgrounddiv = backgrounddiv;
	drawer.htmltable = htmltable;
	drawer.canvas = canvas;
	drawer.infodiv = infodiv;

	drawer.width = null;
	drawer.height = null;

	drawer.last_draw_was_pv = false;
	drawer.tablestate = new_2d_array(25, 25, null);		// 2d array of "", "b", "w", "ko" ... tracks the actual state of the TDs
	drawer.needed_marks = new_2d_array(25, 25, null);	// 2d array of objects representing stuff to draw on the canvas. Built up by the functions.

	return drawer;
}

let board_drawer_prototype = {

	rebuild: function(width, height) {

		// Reset all the things.
		// Called when board logical size changes.
		// Called when square size changes.
		// Called when line width changes.

		if (!width || !height) {
			throw "rebuild() needs board sizes";
		}

		// Remove all registered "mouseenter" handlers on the old TD elements...
		// This might be rather unnecessary, they should get GC'd anyway.

		if (this.width && this.height) {
			for (let x = 0; x < this.width; x++) {
				for (let y = 0; y < this.height; y++) {
					let td = this.htmltable.getElementsByClassName("td_" + xy_to_s(x, y))[0];
					td.removeEventListener("mouseenter", mouseenter_handlers[x][y]);
				}
			}
		}

		this.width = width;
		this.height = height;

		let png = background(this.width, this.height, config.square_size);
		this.htmltable.style["background-image"] = `url("${png}")`;
		this.htmltable.innerHTML = "";

		for (let y = 0; y < this.height; y++) {
			let tr = document.createElement("tr");
			this.htmltable.appendChild(tr);
			for (let x = 0; x < this.width; x++) {
				let td = document.createElement("td");
				let s = xy_to_s(x, y);
				td.className = "td_" + s;
				td.width = config.square_size;
				td.height = config.square_size;
				td.addEventListener("mouseenter", mouseenter_handlers[x][y]);	// Add "mouseenter" handler to the TD element.
				tr.appendChild(td);
			}
		}

		for (let x = 0; x < this.width; x++) {
			for (let y = 0; y < this.height; y++) {
				this.tablestate[x][y] = "";
			}
		}

		this.backgrounddiv.style.width = (this.width * config.square_size).toString() + "px";
		this.backgrounddiv.style.height = (this.height * config.square_size).toString() + "px";

		this.htmltable.style.width = (this.width * config.square_size).toString() + "px";
		this.htmltable.style.height = (this.height * config.square_size).toString() + "px";

		this.canvas.width = Math.max(19, this.width) * config.square_size;		// We force the canvas to be at least big enough for a 19x19 board, this
		this.canvas.height = Math.max(19, this.height) * config.square_size;	// makes other elements like the graph stay put when the board is smaller.

		this.fix_infodiv();
	},

	fix_infodiv: function() {
		this.infodiv.style["font-size"] = config.info_font_size.toString() + "px";
	},

	// --------------------------------------------------------------------------------------------

	clear_canvas: function() {
		let ctx = this.canvas.getContext("2d");
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
	},

	fcircle: function(x, y, fraction, colour) {					// fraction being a size between 0 and 1
		let ctx = this.canvas.getContext("2d");
		ctx.fillStyle = colour;
		let gx = x * config.square_size + (config.square_size / 2);
		let gy = y * config.square_size + (config.square_size / 2);
		ctx.beginPath();
		ctx.arc(gx, gy, fraction * config.square_size / 2, 0, 2 * Math.PI);
		ctx.fill();
	},

	circle: function(x, y, linewidth, colour) {
		let ctx = this.canvas.getContext("2d");
		ctx.lineWidth = linewidth;
		ctx.strokeStyle = colour;
		let gx = x * config.square_size + (config.square_size / 2);
		let gy = y * config.square_size + (config.square_size / 2);
		ctx.beginPath();
		ctx.arc(gx, gy, (config.square_size / 2) - (linewidth / 2), 0, 2 * Math.PI);
		ctx.stroke();
	},

	fsquare: function(x, y, colour) {
		let ctx = this.canvas.getContext("2d");
		ctx.fillStyle = colour;
		let gx = x * config.square_size + (config.square_size / 3);
		let gy = y * config.square_size + (config.square_size / 3);
		ctx.fillRect(gx, gy, config.square_size / 3, config.square_size / 3);
	},

	text: function(x, y, msg, colour) {
		let ctx = this.canvas.getContext("2d");
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.font = `${config.board_font_size}px Arial`;
		ctx.fillStyle = colour;
		let gx = x * config.square_size + (config.square_size / 2);
		let gy = y * config.square_size + (config.square_size / 2);
		ctx.fillText(msg, gx, gy + 1);
	},

	text_two: function(x, y, msg, msg2, colour) {
		let ctx = this.canvas.getContext("2d");
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.font = `${config.board_font_size}px Arial`;
		ctx.fillStyle = colour;
		let gx = x * config.square_size + (config.square_size / 2);
		let gy = y * config.square_size + (config.square_size / 3) - 0.5;
		ctx.fillText(msg, gx, gy + 1);
		gy = y * config.square_size + (config.square_size * 2 / 3) + 0.5;
		ctx.fillText(msg2, gx, gy + 1);
	},

	set_td: function(x, y, foo) {

		let td = this.htmltable.getElementsByClassName("td_" + xy_to_s(x, y))[0];
		if (!td) throw "set_td(): bad x/y";

		switch (foo) {
			case "":
				td.style["background-image"] = "";
				break;
			case "b":
				td.style["background-image"] = black_stone_url;
				break;
			case "w":
				td.style["background-image"] = white_stone_url;
				break;
			case "ko":
				td.style["background-image"] = ko_marker_url;
				break;
			default:
				throw "set_td(): bad call";
		}

		this.tablestate[x][y] = foo;
	},

	// --------------------------------------------------------------------------------------------

	draw_standard: function(node) {

		this.draw_board(node.get_board());
		this.draw_node_info(node);

		let filtered_infos = moveinfo_filter(node);
			
		// this.plan_death_marks();							// FIXME
		this.plan_previous_markers(node);
		this.plan_analysis_circles(node, filtered_infos);
		this.plan_next_markers(node);

		this.draw_canvas();

	},

	draw_pv: function(node, point) {
		return false;
	},

	// --------------------------------------------------------------------------------------------

	draw_board: function(board) {

		if (this.width !== board.width || this.height !== board.height) {
			this.rebuild(board.width, board.height);
		}

		let board_ko_x = board.ko ? board.ko.charCodeAt(0) - 97 : -1;
		let board_ko_y = board.ko ? board.ko.charCodeAt(1) - 97 : -1;

		for (let x = 0; x < this.width; x++) {
			for (let y = 0; y < this.height; y++) {

				let desired = board.state[x][y];

				if (x === board_ko_x && y === board_ko_y) {
					desired = "ko";
				}

				if (this.tablestate[x][y] !== desired) {
					this.set_td(x, y, desired);
				}
			}
		}
	},

	// --------------------------------------------------------------------------------------------

	draw_canvas: function() {

		this.clear_canvas();

		// Draw the canvas based on what's in this.needed_marks.
		// Also clear items from the needed_marks as they are drawn.

		for (let x = 0; x < this.width; x++) {

			for (let y = 0; y < this.height; y++) {

				let o = this.needed_marks[x][y];
				if (!o) {
					continue;
				}

				if (o.type === "analysis") {

					this.fcircle(x, y, 1, config.wood_colour);

					if (o.fill) {
						this.fcircle(x, y, 1, o.fill);
					}

					if (o.next_mark_colour) {
						this.circle(x, y, config.next_marker_linewidth, o.next_mark_colour);
					}

					if (o.text.length >= 2) {
						this.text_two(x, y, o.text[0], o.text[1], "#000000ff");
					} else if (o.text.length === 1) {
						this.text(x, y, o.text[0], "#000000ff");
					}

				} else if (o.type === "previous") {

					this.fcircle(x, y, 0.4, config.previous_marker);

				} else if (o.type === "next") {

					this.circle(x, y, config.next_marker_linewidth, o.colour);

				}

				this.needed_marks[x][y] = null;
			}
		}
	},

	// --------------------------------------------------------------------------------------------

	plan_death_marks: function(board, ownership, ownership_perspective) {
		if (!config.dead_stone_prediction || !ownership) {
			return;
		}
	},

	plan_previous_markers: function(node) {
		let moves_played = node.all_values("B").concat(node.all_values("W"));
		for (let s of moves_played) {			// Probably just one (but illegal SGF is possible).
			if (s.length === 2) {
				let x = s.charCodeAt(0) - 97;
				let y = s.charCodeAt(1) - 97;
				if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
					this.needed_marks[x][y] = {type: "previous"};
				}
			}
		}
	},

	plan_analysis_circles: function(node, filtered_infos) {
		
		if (!config.candidate_moves) {
			return;
		}

		let board = node.get_board();

		let number_types = config.numbers.split(" + ");

		for (let info of filtered_infos) {

			let s = board.parse_gtp_move(info.move);

			if (s.length !== 2) {				// This is a pass.
				continue;
			}

			let x = s.charCodeAt(0) - 97;
			let y = s.charCodeAt(1) - 97;

			let o = {
				type: "analysis",
				text: [],
				fill: null,
				next_mark_colour: null,			// Maybe set by plan_next_markers().
			};

			if (info.order === 0) {
				if (board.active === "b") o.fill = config.top_colour_black;
				if (board.active === "w") o.fill = config.top_colour_white;
			} else if (config.visit_colours) {
				let opacity_hex = float_to_hex_ff(info.visits / filtered_infos[0].visits);
				if (board.active === "b") o.fill = config.off_colour_black.slice(0, 7) + opacity_hex;
				if (board.active === "w") o.fill = config.off_colour_white.slice(0, 7) + opacity_hex;
			}

			for (let t of number_types) {
				o.text.push(string_from_info(info, node, t));
			}

			this.needed_marks[x][y] = o;
		}
	},

	plan_next_markers: function(node) {
		if (!config.next_move_markers) {
			return;
		}
		let board = node.get_board();
		for (let key of ["B", "W"]) {
			for (let n = 0; n < node.children.length; n++) {
				let moves_played = node.children[n].all_values(key);
				for (let s of moves_played) {			// Probably just one per child.
					if (s.length === 2) {
						let x = s.charCodeAt(0) - 97;
						let y = s.charCodeAt(1) - 97;
						if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
							if (this.needed_marks[x][y] && this.needed_marks[x][y].type === "analysis") {
								this.needed_marks[x][y].next_mark_colour = (key === "B") ? "#00000080" : "#ffffffa0";
							} else {
								this.needed_marks[x][y] = {
									type: "next",
									colour: (key === "B") ? "#00000080" : "#ffffffa0"
								};
							}
						}
					}
				}
			}
		}
	},

	// --------------------------------------------------------------------------------------------

	draw_node_info: function(node, override_moveinfo) {		// Is there a reason this isn't a separate module?

		if (hub.engine.problem_text()) {
			this.draw_engine_problem();
			return;
		}

		let board = node.get_board();

		let last_move = "";
		let last_move_props = node.all_values("B").concat(node.all_values("W"));
		if (last_move_props.length === 1) {
			last_move = board.gtp(last_move_props[0]);
		}

		let s = "";

		s += `<span class="boardinfo_rules">Rules: <span class="info_highlight">${pad(board.rules, 16)}</span></span>`;
		s += `<span class="boardinfo_komi">Komi: <span class="info_highlight">${pad(board.komi, 8)}</span></span>`;
		s += `Prev: <span class="info_highlight">${pad(last_move, 6)}</span>`;
		s += `<span class="boardinfo_numbers">Showing: <span class="info_highlight">${pad(config.candidate_moves ? config.numbers : "(hidden)", 11)}</span></span>`;

		s += "<br>";

		let move = "";
		let score = "";
		let visits = "";

		if (node.has_valid_analysis()) {

			let moveinfo = override_moveinfo || node.analysis.moveInfos[0];

			move = moveinfo.move;

			visits = `${moveinfo.visits} / ${node.analysis.rootInfo.visits}`;

			let lead = moveinfo.scoreLead;
			let leader = ((lead >= 0 && board.active === "b") || (lead < 0 && board.active === "w")) ? "B" : "W";
			if (lead < 0) lead *= -1;
			score = `${leader}+${lead.toFixed(1)}`;
		}

		let capstring = `${board.caps_by_b} | ${board.caps_by_w}`;

		s += `Caps by B|W: <span class="info_highlight">${pad(capstring, 9)}</span>`;
		s += `Score: <span class="info_highlight">${pad(score, 8)}</span>`;
		s += `${override_moveinfo ? "This" : "Best"}: <span class="info_highlight">${pad(move, 7)}</span>`;
		s += `Visits: <span class="info_highlight">${pad(visits, 15)}</span>`;

		this.infodiv.innerHTML = s;
	},

	draw_engine_problem: function() {
		let s = hub.engine.problem_text();
		this.infodiv.innerHTML = `<span class="info_highlight">${s}<br>Resolve this via the Setup menu.</span>`;
	},

};

// ------------------------------------------------------------------------------------------------

function string_from_info(info, node, type) {

	let val;			// It seems using let inside a switch is dubious.
	let text;
	let absl;

	switch (type) {

		case "Winrate":
			return Math.floor(Math.max(0, info.winrate * 100)).toString();
		case "LCB":
			return Math.floor(Math.max(0, info.lcb * 100)).toString();
		case "Visits (%)":
			return Math.floor(info.visits / node.analysis.rootInfo.visits * 100).toString();
		case "Policy":
			return Math.floor(info.prior * 100).toString();
		case "Score":
			val = info.scoreLead;
			text = val < 0 ? "-" : "+";
			absl = Math.abs(val);
			if (absl < 10) {
				text += absl.toFixed(1);
				if (text === "-10.0") text = "-10";
				if (text === "+10.0") text = "+10";
			} else {
				text += Math.floor(absl);
			}
			return text;
		case "Delta":
			val = info.scoreLead - node.analysis.moveInfos[0].scoreLead;
			text = val < 0 ? "-" : "+";
			absl = Math.abs(val);
			if (absl < 10) {
				text += absl.toFixed(1);
				if (text === "-10.0") text = "-10";
				if (text === "+10.0") text = "+10";
				if (text === "+0.0" || text === "-0.0") text = "0";
			} else {
				text += Math.floor(absl);
			}
			return text;
		case "Visits":
			if (info.visits > 9950) {
				return (info.visits / 1000).toFixed(0) + "k";
			} else if (info.visits > 999) {
				return (info.visits / 1000).toFixed(1) + "k";
			}
			return info.visits.toString();
		case "Order":
			return (info.order + 1).toString();
		default:
			return "?";
	}
}

// ------------------------------------------------------------------------------------------------

module.exports = new_board_drawer;