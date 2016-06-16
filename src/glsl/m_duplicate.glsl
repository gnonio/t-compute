void main( void ) {
	float S = UVs.s;
	float T = UVs.t;
	#ifdef FLIPY
		T = 1.0 - UVs.t;		
	#endif

	float A_value = get_channel_value( A, Achan, vec2( S, T ) );
	gl_FragColor = set_channel_value( OUTchan, A_value );
}
