(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Tensor = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * @author gnonio / http://www.euclidiana.pt
 *
 * Merged from weblas unpacked plugin ( https://github.com/gnonio/weblas-unpacked )
 *
 * Tensor
 *
 */

var gl

try {
	var tcompute = TCompute === undefined
} catch ( error ) { console.info( 'Tensor', error ) }

try {
	if ( window.tcompute === undefined ) {
		window.tcompute = new TCompute()
	}
	gl = window.tcompute
} catch ( error ) { console.info( 'Tensor', error ) }

module.exports = Tensor

function Tensor( shape, data/*, format, type*/ ) {
	/*if ( shape[0] * shape[1] != data.length )
		throw new Error('Shape must check with Data size ( ' + shape[0] + '*' + shape[1] + ' != ' + data.length + ' )')*/

	var M = shape[0],
		N = shape[1]

	this.shape = shape

	this.gl = gl
	
	this.requires_padding = N % 4 != 0
	this.requires_encode = !this.gl.float_support

	this.packed = false
	this.isInput = false

	this.mixed = []

	if ( data === undefined || data === null || data.length === 0 ) {
		var glFormat = gl.context.RGBA
		var glType = gl.context.FLOAT
		/*if ( format !== undefined ) glFormat = gl.context[ format ]
		if ( type !== undefined ) glType = gl.context[ type ]*/
		this.texture = gl.setupTexture( M, N, null, false, glFormat, glType )
		this.channel = 0
	} else {
		this.isInput = true
		if ( !( data instanceof Float32Array ) ) data = Float32Array.from( data )
		this.texture = gl.setupTexture( M, N, data, false, gl.context.LUMINANCE, gl.context.FLOAT )
		this.channel = 0 // 0 = RED, 1 = GREEN, 2 = BLUE, 3 = ALPHA
	}
	// Create THREE texture
	try {
		if ( Number( THREE.REVISION ) >= 76 ) {
			var texture = new THREE.GpuTexture( this.texture, this.shape[1], this.shape[0], THREE.RGBAFormat, THREE.FloatType )
			this.THREE = texture
		}
	} catch ( error ) {}

}

Tensor.setGL = function( gl_mngr ) {
	gl = gl_mngr
}

Tensor.prototype.delete = function() {
	var gl = this.gl
	
	gl.context.deleteTexture( this.texture )
	this.texture = null
	this.shape = null
	
	this.requires_padding = null
	this.requires_encode = null
	this.packed = null
	this.channel = null
	
	this.mixed = null
}

Tensor.prototype.transfer = function( keep ) {
	var gl = this.gl
	
	if ( !this.packed ) {
		console.info('transfer(): Unpacked texture - using download()')
		return this.download( keep )
	}

	var M = this.shape[0],
		N = this.shape[1],
		out,
		result

	if ( this.requires_encode ) {
		console.info('transfer(): using float encode.')
		console.warn('transfer(): Packed texture - requires encode not yet supported.')
		// Fixme: using textures in different gl.contexts
		
		// create output texture
		/*out = weblas.gpu.gl.createOutputTexture( M, N )
		// float extraction
		weblas.gpu.gl.encode( M, N, this.texture, out )
		result = new Float32Array( weblas.gpu.gl.readData( M, N ) )
		
		// clean up
		weblas.gpu.gl.context.deleteTexture(out)*/
	} else {
		// direct read floats, functions deal with adjusting ouput texture format/shape
		out = gl.setupTexture( M, N, null, true, gl.context.RGBA, gl.context.FLOAT )
		gl.read( M, N, this, out )
		result = gl.readFloat( M, N, true )
		
		// clean up
		gl.context.deleteTexture(out)
	}

	if ( !keep ) {
		this.delete()
	}

	return result
}

Tensor.prototype.transpose = function( keep ) {
	var gl = this.gl
	
	var M = this.shape[0],
		N = this.shape[1]

	// create new texture to hold tranpose
	var tT
	
	if ( this.packed ) {
		/*tT = new weblas.pipeline.Tensor( [N, M], null )
		gl.transpose_packed( M, N, this.texture, tT.texture )*/
	} else {
		//tT = new weblas.unpacked.Tensor( [N, M], null )
		tT = new Tensor( [N, M], null )
		gl.transpose( M, N, this, tT )
	}

	if ( !keep ) {
		this.delete()
	}

	return tT
}

/*	Facility to convert in-GPU unpacked textures to packed
 */
Tensor.prototype.pack = function() {
	var gl = this.gl
	
	if ( this.packed ) {
		console.warn('pack(): Tensor is already packed to an RGBA texture.')
		return
	}

	var M = this.shape[0],
		N = this.shape[1],
		out
	
	// create output texture	
	out = gl.setupTexture( M, N, null, true, gl.context.RGBA, gl.context.FLOAT )
	// invoke shader
	gl.pack( M, N, this, out )
	// clean up
	gl.context.deleteTexture( this.texture )

	this.packed = true
	//this.format = gl.context.RGBA
	this.channel = null
	this.texture = out
}

/*	Facility to convert in-GPU packed textures to unpacked
	optionaly receives a slot selection - 0 by default
 */
Tensor.prototype.unpack = function( slot ) {
	var gl = this.gl
	
	if ( !this.packed ) {
		console.warn('unpack(): Tensor is already unpacked to an RGBA texture.')
		return
	}

	var M = this.shape[0],
		N = this.shape[1],
		out
	
	this.channel = typeof slot == 'undefined' ? 0 : slot

	// create output texture
	out = gl.setupTexture( M, N, null, false, gl.context.RGBA, gl.context.FLOAT )
	// invoke shader
	gl.unpack( M, N, this, out )
	// clean up
	gl.context.deleteTexture( this.texture )
	
	this.packed = false
	//this.format = gl.context.RGBA
	this.texture = out
}

/*	Facility akin to transfer() for unpacked textures
	optionally allows to output as unpacked texture
	defaults to packed type as that is what we usually need on the CPU side
 */
Tensor.prototype.download = function( keep, unpacked, pretify ) {
	var gl = this.gl
	
	if ( this.packed ) {
		console.info('download(): Packed texture - using transfer()')
		return this.transfer( keep )
	}
	/*if ( !gl.context.isTexture( this.texture ) )
		throw new Error('download(): Texture is void.')*/

	var M = this.shape[0],
		N = this.shape[1],
		out,
		result,
		result_str
	
	var packed = unpacked === undefined ? true : !unpacked
	
	// create output texture	
	out = gl.setupTexture( M, N, null, packed, gl.context.RGBA, gl.context.FLOAT )
	// invoke shader
	gl.render( M, N, this, out, packed )
	result = gl.readFloat( M, N, packed )
	
	// clean up
	gl.context.deleteTexture( out )
	
	if ( !keep ){
		this.delete()
	}
	
	var prety = pretify === undefined ? false : true
	if ( prety ) {
		result_str = pretifyTensor( { shape: this.shape, data: result, packed: packed } )
		result = { data: result, string: result_str }
	}
	
	return result
}

function pretifyTensor( tensor ) {
	var shape = tensor.shape
	var array = tensor.data
	var packed = tensor.packed
	
	var M = shape[ 0 ]
	var N = packed ? shape[ 1 ] : shape[ 1 ] * 4
	var stride = 1 //packed ? 1 : 1
	var result_str = ''
	
	var max = 0
	var anyFraction = false
	for ( var i = 0; i < M * N; i++ ) {
		var value = array[ i ]
		max = value > max ? value : max
		if ( value % 1 !== 0 ) anyFraction = true
	}
	var maxFD = anyFraction ? 3 : 0
	var maxID = 1
	for ( var i = 1; i < 6; i++ ) {
		var floor = Math.pow( 10, i )
		var ceil = Math.pow( 10, i + 1 )
		if ( max >= floor && value < ceil ) maxID = i + 1
	}

	var maxD = maxID + 0 + maxFD
	for ( var i = 0; i < M; i++ ) {
		var rj = ''
		for ( var j = 0; j < N; j++ ) {
			var fourths = j % 4 === 3
			var first = j === 0
			var last = j + 1 === N
			
			var pixel = fourths && !first && !last ? ' | ' : ''
			var comma = ( !fourths || first ) && !last ? ', ' : ''
			
			var value = array[ i * N * stride + j * stride ]
			var value_str = fillString( value, maxD, maxID, maxFD )
			
			rj += value_str + comma + pixel
		}
		var endl = i + 1 === M ? '' : '\r\n'
		result_str += rj + endl
	}
	var packed_str = packed ? 'Packed' : 'Unpacked'
	var info = 'Shape: ' + M + 'x' + N + ' | ' + packed_str + '\r\n'
	return info + result_str
}

function fillString( value, digits, integer, fraction ) {
	var maxID = 1
	for ( var i = 1; i < 6; i++ ) {
		var floor = Math.pow( 10, i )
		var ceil = Math.pow( 10, i + 1 )
		if ( value >= floor && value < ceil ) maxID = i + 1
	}
	var length = digits - maxID - fraction
	var v = new Intl.NumberFormat( 'en-IN', {
			useGrouping: false,
			//maximumSignificantDigits: 2
			minimumIntegerDigits: 1,
			//maximumIntegerDigits: i,
			minimumFractionDigits: fraction,
			maximumFractionDigits: fraction
		} ).format( value )
	var s = String( v )
	var pre = ' '.repeat( length )
	var pos = ''
	var ss = pre + v + pos
	return ss
}

/*	Facility to clone textures, for in-GPU staged computations
	a logical duplication is insuficient since data may be updated
	and pre-update values required (ie. self addition a += b)
 */
Tensor.prototype.duplicate = function() {
	var gl = this.gl
	
	var M = this.shape[0],
		N = this.shape[1]

	// create new tensor to hold duplicate
	var clone

	if ( this.requires_encode ) {
		console.warn('duplicate(): requires_encode.')
		/*var duplicate = this.transfer( true )
		clone = new weblas.pipeline.Tensor( this.shape, duplicate )*/
	} else {
		if ( this.packed ) {
			console.warn('duplicate(): Packed texture - duplicate not yet supported.')
			// Fixme: using textures in different gl.contexts
			//clone = new weblas.unpacked.Tensor( this.shape, null, 'RGBA', 'UNSIGNED_BYTE' )
			//gl.duplicate( M, N, this, clone, false )
			
			/*clone = new weblas.pipeline.Tensor( this.shape, new Float32Array( M * N ) )
			weblas.gpu.gl.duplicate( M, N, this, clone, true )*/
		} else {
			clone = new Tensor( this.shape, null )
			clone.isInput = this.isInput
			gl.duplicate( M, N, this, clone, false )
		}
	}
	return clone
}
Tensor.prototype.mixin = function ( red, green, blue, alpha ) {
	//var gl = this.gl
	
	//var old_texture = this.texture
	
	var mix = mixin.apply( this, red, green, blue, alpha )
	this.mixed = mix.mixed
	this.texture = mix.texture
	
	this.THREE.image.webgltexture = mix.texture
	this.THREE.needsUpdate = true
	
	// delete
	//gl.context.deleteTexture( old_texture )
}

function selfout( tensors, self ) {
	var include = []
	for ( var t in tensors ) {
		if ( tensors[ t ] != self ) include.push( tensors[ t ] )
	}
	return include
}
/*	Facility to combine Tensors together
 */
function mixin( red, green, blue, alpha ) {
	// first non null tensor defines shape
	var tensors = []
	var mtensors = []
	for ( var t in arguments ) {		
		//if ( arguments[t] instanceof weblas.unpacked.Tensor ) {
		if ( arguments[t] instanceof Tensor ) {
			tensors.push( arguments[t] )
			mtensors.push( arguments[t] )
		}
	}

	if ( tensors.length > 0 ) {
		for ( var t in tensors ) {		
			if ( tensors[t].shape[0] != tensors[0].shape[0] ||
				 tensors[t].shape[1] != tensors[0].shape[1] )
				throw new Error('mixin(): Tensors must have same shape.')
		}
	}

	var M = tensors[0].shape[0],
		N = tensors[0].shape[1]

	//var mix = new weblas.unpacked.Tensor( tensors[0].shape, null )
	var mix = new Tensor( tensors[0].shape, null )

	var gl = tensors[0].gl // must fetch gl from first tensor, we're out of scope

	gl.mixin( M, N, red, green, blue, alpha, mix )

	// mtensors.push( mix )

	// some memory management before updating tensors
	for ( var t in arguments ) {
		var tensor = arguments[ t ]
		if ( tensor != null ) {
			// delete original texture if not shared anymore
			if ( tensor.mixed.length == 0 ) {
				//gl.context.deleteTexture( tensor.texture )
			} else {
				// just remove itself from other Tensor's mixed with references
				for ( var tt in tensor.mixed ) {
					tensor.mixed[ tt ].mixed = selfout( tensor.mixed[ tt ].mixed, tensor )
				}
			}
		}
	}

	// final updates - should this really be done in stages?
	// 				 - playing safe, textures might stay around, worse... unreferenced
	for ( var t in arguments ) {
		var tensor = arguments[ t ]
		if ( tensor != null ) {
			// update Tensor reference to new texture
			tensor.texture = mix.texture
			// update Tensor reference to new slot
			tensor.channel = Number( t )
			// update Tensors mixed with ( including the mixer tensor (or not) )
			tensor.mixed = selfout( mtensors, tensor )
		}
	}

	mix.mixed = tensors

	//console.log( tensors )

	return mix
}
module.exports.mixin = mixin
},{}]},{},[1])(1)
});