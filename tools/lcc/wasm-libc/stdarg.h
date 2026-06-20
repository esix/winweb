/* stdarg.h for the lcc-wasm target.
 *
 * Matches the back end's varargs ABI: a variadic call marshals every argument
 * into an 8-byte slot in a shadow-stack buffer and passes a pointer to it; the
 * callee's fixed params live in that same buffer, so &last is a real address.
 * va_list is just a walking pointer; each va_arg advances one 8-byte slot.
 */
#ifndef _WASM_STDARG_H
#define _WASM_STDARG_H

typedef char *va_list;

#define va_start(ap, last) ((ap) = (va_list)&(last) + 8)
#define va_arg(ap, type)   (*(type *)(((ap) += 8) - 8))
#define va_end(ap)         ((void)0)
#define va_copy(dst, src)  ((dst) = (src))

#endif
