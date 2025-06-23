export type DynBuf  = {
	data: Buffer;
	length: number;
	readOffset: number;
}

export function bufSize(buf:DynBuf): number {
	return buf.data.length - buf.readOffset
}

function bufCapacity(buf: DynBuf):number {
	return buf.data.length;
}

export function bufPush(data: Buffer, buf: DynBuf):void {
	const newLen = buf.length + data.length;
	
	if(newLen > bufSize(buf)) {
		//grow the buffer
		let cap = Math.max(bufSize(buf), 32);
		while(cap < newLen) {
			cap *= 2;
		}
		let grown = Buffer.alloc(cap);
		buf.data.copy(grown, 0, buf.readOffset);  //since we're copying anyway, we should take care of unused space
		buf.data= grown;
		buf.readOffset = 0;
	}
	
	data.copy(buf.data, buf.length, 0);  //src.copy(dst, dst_start, src_start, src_end)
	buf.length=newLen;
}

export function bufPop(buf:DynBuf, len:number):void {
	//copyWithin is not a Buffer class method, is inherited from TypedArray class since Buffer extends that
	buf.readOffset += len;
	buf.length-=len;
	if(buf.readOffset >= bufCapacity(buf)/2) {
		buf.data = Buffer.from(buf.data.subarray(buf.readOffset));
		buf.readOffset = 0;
	}
	
}
