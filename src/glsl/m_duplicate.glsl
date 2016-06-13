void main( void ) {
	float col_t = UVs.s;
	float row_t = UVs.t;
	/*#ifdef FLIPY
	float row_t = 1.0 - UVs.t;
	#else
	float row_t = UVs.t;
	#endif*/

	float A_value = get_channel_value( A, Achan, vec2( col_t, row_t ) );
	gl_FragColor = set_channel_value( OUTchan, A_value );
}
