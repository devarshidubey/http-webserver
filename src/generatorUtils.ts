export type BufferGenerator = AsyncGenerator<Buffer, void, void>

export async function* countSheep(): BufferGenerator {
	for(let i = 0; i < 100; i++) {
		await new Promise((resolve, reject)=> {
			setTimeout(resolve, 1000);
		});
		yield Buffer.from(`${i}\r\n`, 'utf-8');
	}
}