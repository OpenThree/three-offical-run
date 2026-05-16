#!/usr/bin/env node
/**
 * 确认工作区变更仅发生在 sync-paths.json 列出的目录内。
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSyncPaths } from './load-sync-paths.mjs';

const __dirname = path.dirname( fileURLToPath( import.meta.url ) );
const ROOT = path.resolve( __dirname, '..' );
const ALLOWED = loadSyncPaths();

function isUnderAllowed( file ) {

	const normalized = file.replace( /\\/g, '/' );

	return ALLOWED.some( ( dir ) =>
		normalized === dir || normalized.startsWith( `${ dir }/` ),
	);

}

function gitLines( args ) {

	const result = spawnSync( 'git', args, { cwd: ROOT, encoding: 'utf8' } );

	if ( result.status !== 0 ) {

		throw new Error( `git ${ args.join( ' ' ) } 失败` );

	}

	return result.stdout.trim().split( '\n' ).filter( Boolean );

}

function getChangedFiles() {

	const files = new Set();

	for ( const file of gitLines( [ 'diff', '--name-only', '--diff-filter=ACDMRTUXB', 'HEAD' ] ) ) {

		files.add( file );

	}

	for ( const file of gitLines( [ 'ls-files', '--others', '--exclude-standard' ] ) ) {

		if ( file.startsWith( '.three-sync-cache' ) ) continue;
		files.add( file );

	}

	return [ ...files ];

}

const violations = [];

for ( const file of getChangedFiles() ) {

	if ( ! isUnderAllowed( file ) ) {

		violations.push( file );

	}

}

if ( violations.length > 0 ) {

	console.error( '[verify] 发现不允许的变更（同步应仅影响 sync-paths.json 中的目录）：' );
	console.error( `[verify] 允许目录: ${ ALLOWED.join( ', ' ) }` );
	for ( const v of violations ) console.error( `  - ${ v }` );
	process.exit( 1 );

}

console.log( `[verify] 变更范围正确，仅涉及: ${ ALLOWED.join( ', ' ) }` );
