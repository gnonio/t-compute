(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.NN = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * @author gnonio / http://www.euclidiana.pt
 *
 * Merged from weblas unpacked plugin ( https://github.com/gnonio/weblas-unpacked )
 *
 * Neural Network computations
 * ReLU, Append bias
 *
 */



try {
	var tcompute = TCompute === undefined
} catch ( error ) { console.info( 'NN', error ) }

try {
	var tensor = Tensor === undefined
} catch ( error ) { console.info( 'NN', error ) }

//	ReLU
//	Shader
var _relu = "void main( void ) {\r\n\tfloat row_t = UVs.y;\r\n\tfloat col_t = UVs.x;\r\n\r\n\tfloat value = get_channel_value( A, Achan, UVs );\r\n\tfloat relu = max( value, 0.0 );\r\n\r\n\tgl_FragColor = set_channel_value( OUTchan, relu );\r\n}\r\n"

//	WebGL
function relu_gl( M, N, tensorA, result ) {
	var objects = this.buffers.framequad
	
	var framebuffer = { width: N, height: M, texture: result.texture, channel: result.channel, bindChannel: true, bindShape: true }
	
	var data = {}

	var textures = {}	
	textures.A = { type: 'sampler2D', value: tensorA, bindChannel: true, bindShape: true }
	
	// GLSL Functions
	var functions = {}
	functions.get_channel_value = this.functions_src.get_channel_value
	functions.set_channel_value = this.functions_src.set_channel_value

	// GLSL Main
	var main = _relu

	var program_name = 'relu'
	this.computePass = {
		objects: 		objects,
		framebuffer: 	framebuffer,
		data: 			data,
		textures: 		textures,
		functions: 		functions,
		main: 			main
	}

	this.computePass.program = this.generateProgram( program_name, true )
	
	this.renderPass()
}
TCompute.prototype.relu = relu_gl

//	Tensor
function relu_fnc( A ) {
	gl = window.tcompute
	
	if ( A.packed ) throw new Error('relu(): Only unpacked textures supported.')
		
	var M = A.shape[0],
		N = A.shape[1]
		
	// create new tensor to hold result
	var relu = new Tensor( [M, N], null )
	
	// invoke shader
	gl.relu( M, N, A, relu )

	return relu
}
module.exports.relu = relu_fnc

//	Append bias column
//	might be useful to generalize this further (ie. scale bias, or arbitrary value)
//	Shader
var _append_bias 		= "void main( void ) {\r\n\tfloat row_t = UVs.y;\r\n\tfloat col_t = UVs.x;\r\n\t\r\n\tvec2 rowcol = get_indices( col_t, OUTshape.x, row_t, OUTshape.y );\r\n\t\r\n\tfloat A_col = rowcol.x;\r\n\tfloat A_row = rowcol.y;\r\n\t\r\n\tfloat A_value = 1.0;\r\n\tif ( A_col < A_cols ) {\r\n\t\tfloat A_index = A_row * A_cols + A_col;\r\n\t\t\r\n\t\tvec2 A_st = get_coords( A_index, A_cols, A_col_hstep, OUTshape.y, OUThalfp.y );\r\n\r\n\t\tA_value = get_channel_value( A, Achan, A_st );\r\n\t}\r\n\r\n\tgl_FragColor = set_channel_value( OUTchan, A_value );\r\n}\r\n"

//	WebGL
function append_bias_gl( M, N, tensorA, result ) {
	var objects = this.buffers.framequad
	
	var framebuffer = { width: N, height: M, texture: result.texture, channel: result.channel, bindChannel: true, bindShape: true }
	
	var data = {}

	var W = N
	var H = M
	
	data = {		
		A_cols: 		{ type: 'uniform1f', value: W - 1 },
		A_col_hstep: 	{ type: 'uniform1f', value: ( 1 / (W - 1) ) * 0.5 }
	}
	
	var textures = {}
	textures.A = { type: 'sampler2D', value: tensorA, bindChannel: true, bindShape: false }

	// GLSL Functions
	var functions = {}
	functions.get_indices 		= this.functions_src.get_indices
	functions.get_coords 		= this.functions_src.get_coords
	functions.get_channel_value = this.functions_src.get_channel_value
	functions.set_channel_value = this.functions_src.set_channel_value

	// GLSL Main
	var main = _append_bias

	var program_name = 'append_bias'

	this.computePass = {
		objects: 		objects,
		framebuffer: 	framebuffer,
		data: 			data,
		textures: 		textures,
		functions: 		functions,
		main: 			main
	}

	this.computePass.program = this.generateProgram( program_name, true )
	
	this.renderPass()
}
TCompute.prototype.append_bias = append_bias_gl

//	Tensor
function append_bias_fnc( A ) {
	gl = window.tcompute
	
	if ( A.packed ) throw new Error('append_bias(): Only unpacked textures supported.')
		
	var M = A.shape[0],
		N = A.shape[1],
		BiasN = N + 1
		
	// create new tensor to hold result
	var bias = new Tensor( [M, BiasN], null )
	
	// invoke shader
	gl.append_bias( M, BiasN, A, bias )

	return bias
}
module.exports.append_bias = append_bias_fnc
},{}]},{},[1])(1)
});