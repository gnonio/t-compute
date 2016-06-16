void main( void ) {
	float col_t = UVs.s;
	#ifdef FLIPY
		float row_t = 1.0 - UVs.t;
	#else
		float row_t = UVs.t;
	#endif

	gl_FragColor = texture2D( A, vec2( col_t, row_t ) );
}
