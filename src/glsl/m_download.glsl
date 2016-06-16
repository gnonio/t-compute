void main( void ) {
	float S = UVs.s;
	float T = UVs.t;
	#ifdef FLIPY
		T = 1.0 - UVs.t;		
	#endif

	gl_FragColor = texture2D( A, vec2( S, T ) );
}
