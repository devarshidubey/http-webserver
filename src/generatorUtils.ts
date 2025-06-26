export type BufferGenerator = AsyncGenerator<Buffer, void, void>

export async function* countSheep(): BufferGenerator {
	for(let i = 0; i < 100; i++) {
		await new Promise((resolve, reject)=> {
			setTimeout(resolve, 1000);
		});
		yield Buffer.from(`${i}\r\n`, 'utf-8');
	}
}

/*
async function* staticFileGenerator(fp: fs.FileHandle, ranges: HTTPRange[], fileSize: number, boundary: string): BufferGenerator {
	try {
		const multipart = (ranges.length > 1);
		for(let i = 0; i < ranges.length; i++) {
			let [start, end] = processRange(ranges[i], fileSize);
			let size = end - start + 1;
			
			if(multipart) {
				yield Buffer.from(`--${boundary}\r\nContent-Type: text/plain\r\nContent-Range: bytes ${start}-${end}/${fileSize}\r\n\r\n`);
			}
			
			let got = 0;
			const buf = Buffer.allocUnsafe(64 * 1024);
			while(got < size) {
				const data = await fp.read({buffer: buf, length: size - got, position: start});
				got += data.bytesRead;
				start += data.bytesRead;
				yield data.buffer.subarray(0, data.bytesRead);
			}
		}
		if(multipart) {
			yield Buffer.from(`--${boundary}--\r\n`);
		}
	}catch(err) {
		throw err;
	} finally {
		await fp.close(); //if this function throws, it is its own responsibility to close the file before ownership is transfered
	}
}
*/