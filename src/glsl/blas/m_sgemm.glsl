void main( void ) {
	float row_t = UVs.y;
	float col_t = UVs.x;
	#ifdef SUMC
	float c = beta * get_channel_value( C, Cchan, UVs );
	#endif
	
	float hstep = K_halfp;// position for shared dimension on source textures
	float sum = 0.0;
	for ( int l = 0 ; l < 4096 ; ++l ) {
		if ( l >= K ) break;    // stop when we finish the row/column

		float ahstep = hstep;
		#ifdef FLIPY
		ahstep = 1.0 - hstep;
		#endif
		// read value from each texture
		float a_ik = get_channel_value( A, Achan, vec2( ahstep, row_t ) );// 3 x 2
		float b_kj = get_channel_value( B, Bchan, vec2( col_t, hstep ) );// 2 x 4

		sum += a_ik * b_kj;
		hstep += K_pixel;
	}

	#ifdef SUMC
	sum += c;
	#endif
	gl_FragColor = set_channel_value( OUTchan, alpha * sum );
}
