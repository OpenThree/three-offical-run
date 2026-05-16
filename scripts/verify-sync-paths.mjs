#!/usr/bin/env node
/**
 * 确认工作区变更仅发生在 sync-paths.json 列出的目录内。
 * 用于 GitHub Actions，防止误改 examples/index.html、assets 等自有内容。
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname( fileURLToPath( import.meta.url ) );
const ROOT = path.resolve( __dirname, '..' );
const ALLOWED = JSON.parse(
	fs.readFileSync( path.join( __dirname, 'sync-paths.json' ), 'utf8' ),
);

function isUnderAllowed( file ) {

	const normalized = file.replace( /\\/g, '/' );

	return ALLOWED.some( ( dir ) =>
		normalized === dir || normalized.startsWith( `${ dir }/` ),
	);

}

const result = spawnSync( 'git', [ 'status', '--porcelain' ], {
	cwd: ROOT,
	encoding: 'utf8',
} );

if ( result.status !== 0 ) {

	console.error( 'git status 失败' );
	process.exit( 1 );

}

const lines = result.stdout.trim().split( '\n' ).filter( Boolean );
const violations = [];

for ( const line of lines ) {

	const file = line.slice( 3 ).trim();
	if ( file.startsWith( '.three-sync-cache' ) ) continue;

	if ( ! isUnderAllowed( file ) ) {

		violations.push( file );

	}

}

if ( violations.length > 0 ) {

	console.error( '[verify] 发现不允许的变更（同步应仅影响 sync-paths.json 中的目录）：' );
	for ( const v of violations ) console.error( `  - ${ v }` );
	process.exit( 1 );

}

console.log( `[verify] 变更范围正确，仅涉及: ${ ALLOWED.join( ', ' ) }` );
