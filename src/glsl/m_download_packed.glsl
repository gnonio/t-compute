void main( void ) {
	float S = UVs.s;
	float T = UVs.t;
	#ifdef FLIPY
		T = 1.0 - UVs.t;		
	#endif

	// get this pixel's row(.x) / column(.y) index
	vec2 PIXEL = getXY( vec2( S, T ), OUTshape );

	// get implied flat index ( as used in cpu buffers )
	float Pbuffer_i = PIXEL.y * OUTshape.x * OUTchannels + PIXEL.x * OUTchannels;

	// corresponding unpacked flat index sequence
	vec4 UPbuffer_i = vec4( Pbuffer_i, Pbuffer_i + 1.0, Pbuffer_i + 2.0, Pbuffer_i + 3.0 );

	// get the sequence of coordinates of unpacked texture
	vec2 UPs = getUV( UPbuffer_i.x, UPshape, UPhalfp );
	vec2 UPt = getUV( UPbuffer_i.y, UPshape, UPhalfp );
	vec2 UPp = getUV( UPbuffer_i.z, UPshape, UPhalfp );
	vec2 UPq = getUV( UPbuffer_i.w, UPshape, UPhalfp );

	// read sequence of four values from unpacked texture
	float r = getUVvalue( A, Achan, UPs );
	float g = getUVvalue( A, Achan, UPt );
	float b = getUVvalue( A, Achan, UPp );
	float a = getUVvalue( A, Achan, UPq );

	// output values PACKED
	gl_FragColor = vec4( r, g, b, a );
}
