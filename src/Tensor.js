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
	this.shape_asPacked = [ shape[0], Math.ceil( shape[1] / 4 ) ]

	this.gl = gl
	
	this.requires_padding = N % 4 !== 0
	this.requires_encode = !this.gl.float_support

	this.packed = false
	this.isInput = false

	this.mixed = []

	if ( data === undefined || data === null || data.length === 0 ) {
		var glFormat = gl.context.RGBA
		var glType = gl.context.FLOAT
		/*if ( format !== undefined ) glFormat = gl.context[ format ]
		if ( type !== undefined ) glType = gl.context[ type ]*/
		this.texture = gl.setupTexture( this.shape, null, glFormat, glType )
		this.channel = 0
	} else {
		this.isInput = true
		if ( !( data instanceof Float32Array ) ) data = Float32Array.from( data )
		this.texture = gl.setupTexture( this.shape, data, gl.context.LUMINANCE, gl.context.FLOAT )
		this.channel = 0 // 0 = RED, 1 = GREEN, 2 = BLUE, 3 = ALPHA
	}
	// Create THREE texture
	if ( this.gl.withTHREE ) {
		var texture = new THREE.GpuTexture( this.texture, this.shape[1], this.shape[0], THREE.RGBAFormat, THREE.FloatType )
		this.THREE = texture
	}

}

Tensor.setGL = function( gl_wrapper ) {
	gl = gl_wrapper
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
		out = gl.setupTexture( this.shape_asPacked, null, gl.context.RGBA, gl.context.FLOAT )
		gl.read( M, N, this, out )
		result = gl.readFramebuffer( this.shape_asPacked )
		
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
		// TODO: set same channel as original? probably
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
	out = gl.setupTexture( this.shape_asPacked, null, gl.context.RGBA, gl.context.FLOAT )
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
	out = gl.setupTexture( this.shape, null, gl.context.RGBA, gl.context.FLOAT )
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
Tensor.prototype.download = function() {
	var options = arguments[ 0 ] instanceof Object ? arguments[ 0 ] : {}
	options.asPacked = options.asPacked === undefined ? true : options.asPacked
	options.pretify = options.pretify === undefined ? false : options.pretify
	options.dispose = options.dispose === undefined ? false : options.dispose
	
	if ( this.packed ) {
		console.info('download(): Packed texture - using transfer()')
		return this.transfer( !options.dispose )
	}
	
	var gl = this.gl

	var M = this.shape[0]
	var	N = this.shape[1]
	
	// the actual required shape can be arbitrary, since the shader computes a flat sequence of elements
	// the number of pixels (ie. M * N) is the actual minimum
	// if we constrain N to a 4 multiple could we also simplify shader?
	// readFramebuffer ignores buffer overruned elements
	// lets keep the obvious logic here for now
	var outputShape = options.asPacked ? this.shape_asPacked : this.shape
	
	// prepare result texture
	var output = gl.setupTexture( outputShape, null, gl.context.RGBA, gl.context.FLOAT )
	
	// invoke computation
	gl.download( output, options.asPacked, this )
	
	// dump results to CPU, usually result stays in GPU and this step is skipped
	var result = gl.readFramebuffer( outputShape )
	
	// clean up
	gl.context.deleteTexture( output )

	if ( options.pretify && !this.packed ) { // never pretify packed tensors for now
		result = pretify( { tensor: this, data: result, asPacked: options.asPacked } )
	}
	
	if ( options.dispose ) this.delete()
	
	return result
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

function pretify( options ) {
	var shape = options.tensor === undefined ? options.shape : options.tensor.shape
	var packed = options.tensor === undefined ? options.packed : options.tensor.packed
	var channel = options.tensor === undefined ? options.channel : options.tensor.channel
	
	var data = options.data
	var asPacked = options.asPacked
	
	var M = shape[ 0 ]
	var N = asPacked ? shape[ 1 ] : shape[ 1 ] * 4
	var stride = 1
	var result_str = ''
	
	var col_max = new Float32Array( N )
	var col_anyFr = new Float32Array( N )
	var col_maxFD = new Float32Array( N )
	var col_maxID = new Float32Array( N )
	var col_maxD = new Float32Array( N )
	for ( var j = 0; j < N; j++ ) {
		for ( var i = 0; i < M; i++ ) {
			var value = data[ i * N * stride + j * stride ]
			col_max[ j ] = value > col_max[ j ] ? value : col_max[ j ]
			if ( value % 1 !== 0 ) col_anyFr[ j ] = true
		}
		
		col_maxFD[ j ] = col_anyFr[ j ] ? 3 : 0
		col_maxID[ j ] = 1
		
		for ( var p = 1; p < 6; p++ ) {
			var floor = Math.pow( 10, p )
			var ceil = Math.pow( 10, p + 1 )
			if ( col_max[ j ] >= floor && col_max[ j ] < ceil ) col_maxID[ j ] = p + 1
		}
		
		col_maxD[ j ] = col_maxID[ j ] + 0 + col_maxFD[ j ]
	}
	
	for ( var i = 0; i < M; i++ ) {
		var rj = ''
		for ( var j = 0; j < N; j++ ) {
			var fourths = j % 4 === 3
			var first = j === 0
			var last = j + 1 === N
			
			var pixel = fourths && !first && !last && !asPacked ? ' | ' : ''
			var comma = ( ( !fourths || asPacked ) || first ) && !last ? ', ' : ''
			
			var value = data[ i * N * stride + j * stride ]
			var value_str = fillString( value, col_maxD[ j ], col_maxFD[ j ] )
			
			rj += value_str + comma + pixel
		}
		var endl = i + 1 === M ? '' : '\r\n'
		result_str += rj + endl
	}
	var packed_str = packed ? 'Packed' : 'Unpacked'
	var asPacked_str = asPacked ? 'asPacked' : 'asUnpacked'
	var info = '\r\nShape: ' + M + 'x' + N + ' | ' + packed_str + ' | ' + asPacked_str + ' | Channel: ' + channel + '\r\n'
	return info + result_str
}
module.exports.pretify = pretify

function fillString( value, digits, fraction ) {
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
	// TODO: set channel as '4', to help distinguish from other tensor types?
	// ie. '0' = default or 'n' = effective channel

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