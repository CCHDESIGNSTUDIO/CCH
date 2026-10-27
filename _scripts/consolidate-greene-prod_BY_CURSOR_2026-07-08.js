#!/usr/bin/env node
'use strict';
if (!process.argv.includes('--project')) process.argv.push('--project', 'cch-design-boards');
require('./consolidate-greene-staging_BY_CURSOR_2026-07-08.js');
