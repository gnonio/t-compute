vec2 get_indices( float col_t, float cols, float row_t, float rows ) {
	float col_index = floor( col_t * cols );
	float row_index = floor( row_t * rows );

	return vec2( col_index, row_index );
}

vec2 getXY( vec2 uv, vec2 shape ) {
	float col_index = floor( uv.s * shape.x );
	float row_index = floor( uv.t * shape.y );

	return vec2( col_index, row_index );
}
