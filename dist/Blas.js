(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Blas = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * @author gnonio / http://www.euclidiana.pt
 *
 * Merged from weblas unpacked plugin ( https://github.com/gnonio/weblas-unpacked )
 *
 * BLAS Computation
 * http://www.netlib.org/blas/#_level_3
 * SGEMM, SSCAL
 *
 */



try {
	var tcompute = TCompute === undefined
} catch ( error ) { console.info( 'Blas', error ) }

try {
	var tensor = Tensor === undefined
} catch ( error ) { console.info( 'Blas', error ) }

//	Shader
var _sgemm = "void main( void ) {\r\n\tfloat row_t = UVs.y;\r\n\tfloat col_t = UVs.x;\r\n\t#ifdef SUMC\r\n\tfloat c = beta * get_channel_value( C, Cchan, UVs );\r\n\t#endif\r\n\t\r\n\tfloat hstep = K_halfp;// position for shared dimension on source textures\r\n\tfloat sum = 0.0;\r\n\tfor ( int l = 0 ; l < 4096 ; ++l ) {\r\n\t\tif ( l >= K ) break;    // stop when we finish the row/column\r\n\r\n\t\tfloat ahstep = hstep;\r\n\t\t#ifdef FLIPY\r\n\t\tahstep = 1.0 - hstep;\r\n\t\t#endif\r\n\t\t// read value from each texture\r\n\t\tfloat a_ik = get_channel_value( A, Achan, vec2( ahstep, row_t ) );// 3 x 2\r\n\t\tfloat b_kj = get_channel_value( B, Bchan, vec2( col_t, hstep ) );// 2 x 4\r\n\r\n\t\tsum += a_ik * b_kj;\r\n\t\thstep += K_pixel;\r\n\t}\r\n\r\n\t#ifdef SUMC\r\n\tsum += c;\r\n\t#endif\r\n\tgl_FragColor = set_channel_value( OUTchan, alpha * sum );\r\n}\r\n"

//	WebGL
function sgemm_gl( M, N, alpha, tensorA, tensorB, beta, tensorC, result ) {
	var objects = this.buffers.framequad

	var framebuffer = {
		width: N,
		height: M,
		texture: result.texture,
		channel: result.channel,
		bindChannel: true,
		bindShape: false
	}

	var data = {}

	var K = tensorA.shape[1]

	data = {
		K: 				{ type: 'uniform1i', value: K },
		K_pixel: 		{ type: 'uniform1f', value: (1 / K) },
		K_halfp: 		{ type: 'uniform1f', value: (1 / K) * 0.5 },

		alpha: 			{ type: 'uniform1f', value: alpha }
	}

	var textures = {}
	textures.A = { value: tensorA, bindChannel: true, bindShape: false }
	textures.B = { value: tensorB, bindChannel: true, bindShape: false }

	if ( tensorC != null ) {
		data.beta = { type: 'uniform1f', value: beta }
		
		textures.C = { value: tensorC, bindChannel: true, bindShape: false }
	}

	// GLSL Functions
	var functions = {}

	functions.get_channel_value = this.functions_src.get_channel_value
	functions.set_channel_value = this.functions_src.set_channel_value

	// GLSL Main
	var flipy = false ? '#define FLIPY\r\n' : ''
	var sumc = tensorC != null ? '#define SUMC\r\n' : ''
	var main = flipy + sumc + _sgemm

	var flipy_pn = false ? '_flipy' : ''
	var program_name = tensorC != null ? 'sgemm_c' + flipy_pn : 'sgemm' + flipy_pn
	this.computePass = {
		objects: 		objects,
		framebuffer: 	framebuffer,
		data: 			data,
		textures: 		textures,
		functions: 		functions,
		main: 			main
	}

	this.computePass.program = this.generateProgram( program_name, false )
	
	this.renderPass()
}
TCompute.prototype.sgemm = sgemm_gl

//	Tensor
function sgemm_fnc() {
	gl = window.tcompute
	
	var args = sgemm_args( arguments )
	//var [M, N, alpha, A, B, beta, C] = sgemm_args( arguments ) // this will be fun
	var M = args[0], N = args[1]
	var alpha = args[2], A = args[3], B = args[4]
	var beta = args[5] , C = args[6]

	if ( A.packed || B.packed ) throw new Error('sgemm(): Only unpacked textures supported.')
	if ( C != null ) { if ( C.packed ) throw new Error('sgemm(): Only unpacked textures supported.') }
	
	var AM = A.shape[0], // 3 = rows = M = H
		AN = A.shape[1], // 2 = cols = N = W
		BM = B.shape[0], // 2 = rows = M = H
		BN = B.shape[1]	 // 4 = cols = N = W
	
	if ( AN != BM ) throw new Error('sgemm(): A / B incompatible dimensions (' + AN + ' != ' + BM + ')' )
	
	// create new tensor to hold result
	var product = new Tensor( [AM, BN], null )

	// invoke shader
	gl.sgemm( AM, BN, alpha, A, B, beta, C, product )

	return product
}
module.exports.sgemm = sgemm_fnc

function sgemm_args() {
	var args = arguments[0]
	var M, N, alpha, A, B, beta, C
	switch( args.length ) {
		case 2: // A, B
			alpha = 1, A = args[0], B = args[1], beta = 1
			M = A.shape[0], N = B.shape[1]
			C = null
		break
		case 3:
			if ( typeof args[0] == 'number' ) { // alpha, A, B
				alpha = args[0], A = args[1], B = args[2], beta = 1
				M = A.shape[0], N = B.shape[1]
				C = null
			} else { // A, B, C
				alpha = 1, A = args[0], B = args[1], beta = 1
				M = A.shape[0], N = B.shape[1]
				C = args[2]
			}
		break
		case 4:
			if ( typeof args[0] == 'number' ) { // alpha, A, B, C
				alpha = args[0], A = args[1], B = args[2], beta = 1
				M = A.shape[0], N = B.shape[1]
				C = args[3]
			} else { // A, B, beta, C
				alpha = 1, A = args[0], B = args[1], beta = args[2]
				M = A.shape[0], N = B.shape[1]
				C = args[3]
			}
		break
		case 5: // alpha, A, B, beta, C
			alpha = args[0], A = args[1], B = args[2], beta = args[3]
			M = A.shape[0], N = B.shape[1]
			C = args[4]
		break
		default:
			throw new Error('sgemm(): unexpected arguments.' )
		break
	}
	return [M, N, alpha, A, B, beta, C]
}

//	Shader
var _sscal 	= "void main( void ) {\t\r\n\tfloat x_value = get_channel_value( X, Xchan, UVs );\r\n\tgl_FragColor = set_channel_value( OUTchan, alpha * x_value );\r\n}"

//	WebGL
function sscal_gl( M, N, alpha, tensorX, result ) {
	var objects = this.buffers.framequad

	var framebuffer = {
		width: N,
		height: M,
		texture: result.texture,
		channel: result.channel,
		bindChannel: true,
		bindShape: false
	}

	var data = {}	
	data.alpha = { type: 'uniform1f', value: alpha }

	var textures = {}	
	textures.X = { type: 'sampler2D', value: tensorX, bindChannel: true, bindShape: false }

	// GLSL Functions
	var functions = {}
	functions.get_channel_value = this.functions_src.get_channel_value
	functions.set_channel_value = this.functions_src.set_channel_value

	// GLSL Main
	var main = _sscal

	var program_name = 'sscal'
	this.computePass = {
		objects: 		objects,
		framebuffer: 	framebuffer,
		data: 			data,
		textures: 		textures,
		functions: 		functions,
		main: 			main
	}
	
	this.computePass.program = this.generateProgram( program_name, false )
	
	this.renderPass()
}
TCompute.prototype.sscal = sscal_gl

//	Tensor
function sscal_fnc() {
	gl = window.tcompute
	
	var args = sscal_args( arguments )
	
	var M = args[0], N = args[1], alpha = args[2], X = args[3]

	if ( X.packed ) throw new Error( 'sscal(): Only unpacked textures supported.' )
	
	// create new tensor to hold result
	var result = new Tensor( [M, N], null )

	// invoke shader
	gl.sscal( M, N, alpha, X, result )

	return result
}
module.exports.sscal = sscal_fnc

function sscal_args() {
	var args = arguments[0]
	var M, N, alpha, X
	switch( args.length ) {
		case 2: // alpha, X
			M = args[1].shape[0], N = args[1].shape[1]
			alpha = args[0], X = args[1]
		break
		default:
			throw new Error('sscal(): unexpected arguments.' )
		break
	}
	return [M, N, alpha, X]
}
},{}]},{},[1])(1)
});