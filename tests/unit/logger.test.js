/**
 * @file tests/unit/logger.test.js
 * @description Unit tests for the colored console logger.
 * @agent QA
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { logger } from '../../src/utils/logger.js';

describe('logger', () => {

  let logSpy;
  let warnSpy;
  let errorSpy;

  beforeEach(() => {
    logSpy   = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy  = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    // Ensure DEBUG is unset before each test
    delete process.env.DEBUG;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.DEBUG;
  });

  it('logger.info() calls console.log', () => {
    logger.info('hello info');
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('logger.info() output includes the message text', () => {
    logger.info('test info message');
    expect(logSpy.mock.calls[0][0]).toContain('test info message');
  });

  it('logger.success() calls console.log', () => {
    logger.success('all done');
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('logger.success() output includes the message text', () => {
    logger.success('export succeeded');
    expect(logSpy.mock.calls[0][0]).toContain('export succeeded');
  });

  it('logger.warn() calls console.warn', () => {
    logger.warn('watch out');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('logger.warn() output includes the message text', () => {
    logger.warn('low memory warning');
    expect(warnSpy.mock.calls[0][0]).toContain('low memory warning');
  });

  it('logger.error() calls console.error', () => {
    logger.error('something broke');
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('logger.error() output includes the message text', () => {
    logger.error('fatal error occurred');
    expect(errorSpy.mock.calls[0][0]).toContain('fatal error occurred');
  });

  it('logger.banner() calls console.log', () => {
    logger.banner();
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('logger.debug() calls console.log when DEBUG env var is set', () => {
    process.env.DEBUG = '1';
    logger.debug('debug detail');
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('logger.debug() output includes the message text when DEBUG is set', () => {
    process.env.DEBUG = 'true';
    logger.debug('trace info');
    expect(logSpy.mock.calls[0][0]).toContain('trace info');
  });

  it('logger.debug() does NOT call console.log when DEBUG env var is not set', () => {
    logger.debug('silent debug');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('logger.info() does not call console.warn or console.error', () => {
    logger.info('neutral message');
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logger.warn() does not call console.log or console.error', () => {
    logger.warn('just a warning');
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logger.error() does not call console.log or console.warn', () => {
    logger.error('only error');
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

});
