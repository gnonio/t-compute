vec2 get_coords( float index, float cols, float cols_halfp, float rows, float row_halfp ) {
	float col_index = modulo( index, cols ); // custom mod function addressing float division rounding error
	float row_index = floor( ( index + 0.5 ) / cols ); // as above
	
	return vec2( col_index * cols_halfp * 2.0 + cols_halfp, row_index * row_halfp * 2.0 + row_halfp );
}

vec2 getUV( float index, vec2 shape, vec2 halfp ) {
	float x = modulo( index, shape.x ); // custom mod function addressing float division rounding error
	float y = floor( ( index + 0.5 ) / shape.x ); // as above
	
	return vec2( x * halfp.x * 2.0 + halfp.x, y * halfp.y * 2.0 + halfp.y );
}
